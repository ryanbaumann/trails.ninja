"""Generation backends. The only part of the harness that needs a GPU.

Two backends, one interface:

    MLXBackend   a local model plus an optional LoRA adapter, on Apple Silicon
    HTTPBackend  any OpenAI-compatible endpoint, so a cloud-tuned model or a frontier
                 API can run the identical suite and land in the identical scorecard

Keeping generation behind this seam is what makes the graders testable. Nothing below
`generate` knows what a voice is.
"""

import json
import os
import time
import urllib.error
import urllib.request

SYSTEM_PROMPT = (
    "You are Ryan Baumann's writing voice and editorial agent. You draft, edit, rewrite, "
    "critique, and present in his style: first person, active, direct. Growth-backwards "
    "framing (lead with the result, what shipped, then the lesson). Conversational but "
    "evidence-led. Use contractions. No em-dashes. No passive voice for your own work. "
    "When editing, preserve the author's intent while shifting register and structure to "
    "match Ryan's patterns. When drafting from scratch, open with a real scenario or "
    "quoted objection, not a thesis statement. Never invent a number, a quotation, or a "
    "source. If you do not have one, say so."
)


def build_messages(item, system_prompt=SYSTEM_PROMPT):
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "[Task: %s]\n%s" % (item["task"], item["prompt"])},
    ]


def clean_output(raw):
    """Strip the wrappers a chat model sometimes leaves on a completion.

    Scaffolding that survives this is a real failure and G-SCAFFOLD should see it, so
    this only removes the unambiguous transport artefacts.
    """
    out = (raw or "").strip()
    for marker in ("<end_of_turn>", "<|im_end|>", "<|endoftext|>"):
        if out.endswith(marker):
            out = out[: -len(marker)].strip()
    if out.startswith("```") and out.count("```") == 2 and "\n" in out:
        first, _, rest = out.partition("\n")
        if len(first) <= 20:
            out = rest.rsplit("```", 1)[0].strip()
    return out


class MLXBackend(object):
    """Local generation through mlx-lm."""

    name = "mlx"

    def __init__(self, model_path, adapter_path=None, think=False):
        import mlx_lm  # imported lazily so the graders run without MLX installed

        self.mlx_lm = mlx_lm
        self.model_path = str(model_path)
        self.adapter_path = str(adapter_path) if adapter_path else None
        self.think = think
        if self.adapter_path:
            self.model, self.tokenizer = mlx_lm.load(self.model_path, adapter_path=self.adapter_path)
        else:
            self.model, self.tokenizer = mlx_lm.load(self.model_path)

    def describe(self):
        return {"backend": "mlx", "model": self.model_path, "adapter": self.adapter_path}

    def _format(self, messages):
        tokenizer = self.tokenizer
        if hasattr(tokenizer, "apply_chat_template") and getattr(tokenizer, "chat_template", None):
            try:
                return tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True,
                    enable_thinking=self.think)
            except TypeError:
                return tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True)
        system = messages[0]["content"]
        user = messages[-1]["content"]
        return ("<start_of_turn>system\n%s<end_of_turn>\n"
                "<start_of_turn>user\n%s<end_of_turn>\n"
                "<start_of_turn>model\n" % (system, user))

    def _sampler(self, temperature, top_p, min_p):
        utils = getattr(self.mlx_lm, "sample_utils", None)
        if not utils or not hasattr(utils, "make_sampler"):
            return None
        for kwargs in ({"temp": temperature, "top_p": top_p, "min_p": min_p},
                       {"temp": temperature, "top_p": top_p},
                       {"temp": temperature}):
            try:
                return utils.make_sampler(**kwargs)
            except TypeError:
                continue
        return None

    def generate(self, messages, max_tokens=1024, temperature=0.7, top_p=0.92,
                 min_p=0.05, seed=None):
        if seed is not None:
            try:
                import mlx.core as mx
                mx.random.seed(seed)
            except ImportError:
                pass
        kwargs = {"max_tokens": max_tokens, "verbose": False}
        sampler = self._sampler(temperature, top_p, min_p)
        if sampler is not None:
            kwargs["sampler"] = sampler
        started = time.time()
        raw = self.mlx_lm.generate(self.model, self.tokenizer,
                                   prompt=self._format(messages), **kwargs)
        return clean_output(raw), round(time.time() - started, 2)


class HTTPBackend(object):
    """Any OpenAI-compatible /v1/chat/completions endpoint.

    Covers a cloud fine-tune, a hosted frontier model as a reference point, and a
    local server. The suite and the graders do not change, which is the only way a
    local-versus-cloud comparison means anything.
    """

    name = "http"

    def __init__(self, base_url, model, api_key_env="VOICE_EVAL_API_KEY", timeout=180):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = os.environ.get(api_key_env, "")
        self.timeout = timeout

    def describe(self):
        return {"backend": "http", "model": self.model, "adapter": self.base_url}

    def generate(self, messages, max_tokens=1024, temperature=0.7, top_p=0.92,
                 min_p=None, seed=None):
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
        }
        if seed is not None:
            payload["seed"] = seed
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = "Bearer %s" % self.api_key
        request = urllib.request.Request(
            "%s/chat/completions" % self.base_url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        started = time.time()
        try:
            response = urllib.request.urlopen(request, timeout=self.timeout)
            body = json.loads(response.read().decode("utf-8"))
            response.close()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:400]
            raise RuntimeError("endpoint returned HTTP %d: %s" % (error.code, detail))
        content = body["choices"][0]["message"].get("content") or ""
        return clean_output(content), round(time.time() - started, 2)
