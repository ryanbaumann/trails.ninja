const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const ORCHESTRATOR_MODEL = 'gemini-3.7-flash';
const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
const QUALITY_IMAGE_MODEL = 'gemini-3.1-flash-image';
const ALLOWED_IMAGE_MODELS = new Set([DEFAULT_IMAGE_MODEL, QUALITY_IMAGE_MODEL]);
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_DATA_CHARS = 8 * 1024 * 1024;

export const MODES = Object.freeze({
  'data-story': 'Data-forward layout with charts, graphs, statistical callouts, trend lines, and percentage highlights.',
  'executive-summary': 'Clean and minimal. Large headline numbers, 3-5 key takeaways, strategic insights, board-ready aesthetics.',
  'technical-deep-dive': 'Dense and precise. Architecture diagrams, code snippets in monospace, system-flow arrows, technical terminology.',
  'classroom': 'Friendly and illustrative. Numbered steps, visual analogies, approachable language, warm colors.',
  'quick-slide': 'Single-slide format with minimal text, high visual impact, presentation-ready large typography.',
  'brandkit': 'Premium brand identity board with clean presentation grids, logo cover mark, color swatches, typography specimens, UI mockups, and art-directed imagery.',
  'blog-post': 'Editorial thumbnail/hero layout with punchy headline, dramatic visual focus, and generous whitespace.',
  'portfolio-showcase': 'Minimalist case-study layout emphasizing alignment grid, milestones, elegant typography, and subtle browser/app chrome.',
  'custom': '',
});

export const SUPPORTED_ASPECTS = new Set(['1:1', '9:16', '16:9', '3:4', '4:3', '1:4', '16:10', '21:9']);

const RESEARCH_SYSTEM_PROMPT = `<role>
You are an expert infographic architect and visual data designer. You transform
raw content into an optimized image-generation prompt that produces a
professional, text-accurate infographic.
</role>

<constitution>
1. NEVER fabricate data, statistics, or claims.
2. Every data point MUST come from the user's content or grounded Google Search results.
3. If information is missing, use Google Search to gather real data from credible sources.
4. Quote ALL text strings exactly as they should appear in the infographic.
</constitution>

<prompt_rules>
The "prompt" field you output is sent directly to an image-generation model. It must:
- Start with: "Generate a professional infographic image"
- Use positive framing only — describe what TO include, never negations.
- Give step-by-step spatial instructions: "At the top, place X. Below that, add Y..."
- Quote ALL text strings exactly, wrapped in quotation marks.
- Specify exact colors using #hex values and describe typography (weight, size, style).
- Include accessibility notes: minimum contrast 4.5:1 for normal text, 3:1 for large text.
- Stay under 800 words — dense and precise, not verbose.
- End with composition notes: spacing, alignment, professional polish.
</prompt_rules>

<visual_modes>
- data-story: Data-forward layout with charts, graphs, statistical callouts, trend lines, and percentage highlights.
- executive-summary: Clean and minimal. Large headline numbers, 3-5 key takeaways, strategic insights, board-ready aesthetics.
- technical-deep-dive: Dense and precise. Architecture diagrams, code snippets in monospace, system-flow arrows, technical terminology.
- classroom: Friendly and illustrative. Numbered steps, visual analogies, approachable language, warm colors.
- quick-slide: Single-slide format with minimal text, high visual impact, presentation-ready large typography.
- brandkit: Premium brand identity board with clean presentation grids, logo cover mark, color swatches, typography specimens, UI mockups, and art-directed imagery.
- blog-post: Editorial thumbnail/hero layout with punchy headline, dramatic visual focus, and generous whitespace.
- portfolio-showcase: Minimalist case-study layout emphasizing alignment grid, milestones, elegant typography, and subtle browser/app chrome.
</visual_modes>

<output_format>
Respond with valid JSON only. No markdown fences. No extra text. Schema:
{
  "analysis": {
    "title": "string — compelling infographic title",
    "subtitle": "string — supporting subtitle",
    "sectionsCount": number,
    "dataPointsCount": number,
    "brandColors": ["#hex", "#hex", "..."],
    "sourceAttribution": "string — source credits"
  },
  "prompt": "string — complete image generation prompt starting with 'Generate a professional infographic image'"
}
</output_format>`;

function result(statusCode, json) {
  return { statusCode, json };
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseDataUrl(value) {
  if (typeof value !== 'string') return null;
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
  if (!match || !ALLOWED_IMAGE_TYPES.has(match[1]) || match[2].length > MAX_IMAGE_DATA_CHARS) return null;
  return { type: 'image', mime_type: match[1], data: match[2].replaceAll(/\s/g, '') };
}

function outputBlocks(interaction) {
  return (Array.isArray(interaction?.steps) ? interaction.steps : [])
    .filter((step) => step?.type === 'model_output' && Array.isArray(step.content))
    .flatMap((step) => step.content);
}

function outputText(interaction) {
  return outputBlocks(interaction)
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function outputImage(interaction) {
  return outputBlocks(interaction).findLast((block) =>
    block?.type === 'image' &&
    ALLOWED_IMAGE_TYPES.has(block.mime_type) &&
    typeof block.data === 'string'
  );
}

function parseJsonText(text) {
  const normalized = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(normalized);
}

async function createInteraction({ apiKey, model, input, responseFormat, thinkingConfig, tools, fetchImpl, signal }) {
  const timeoutSignal = AbortSignal.timeout(120_000);
  const response = await fetchImpl(INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Revision': '2026-05-20',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      input,
      store: false,
      ...(responseFormat ? { response_format: responseFormat } : {}),
      ...(thinkingConfig ? { thinking_config: thinkingConfig } : {}),
      ...(tools ? { tools } : {}),
    }),
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  });

  if (!response.ok) {
    const statusCode = response.status === 400 ? 400
      : response.status === 401 || response.status === 403 ? 401
        : response.status === 429 ? 429
          : 502;
    const body = await response.text().catch(() => '');
    throw Object.assign(new Error(`Gemini request failed: ${response.statusText}`), { statusCode, details: body });
  }
  return response.json();
}

export function validateInfographicApiKey(value) {
  const apiKey = cleanText(value, 200);
  return /^[\x21-\x7E]{20,200}$/.test(apiKey) ? apiKey : null;
}

export async function handleInfographicAgentApi({
  pathname,
  method,
  body,
  apiKey,
  credentialSource = 'byok',
  fetchImpl = globalThis.fetch,
  signal,
}) {
  if (method !== 'POST') return result(405, { error: 'Method not allowed' });
  if (!validateInfographicApiKey(apiKey)) {
    return result(401, {
      error: 'Enter a valid Gemini API key to continue.',
      code: 'INVALID_GEMINI_KEY',
    });
  }

  try {
    if (pathname === '/api/infographic-agent/validate-key') {
      const response = await fetchImpl(`${MODELS_URL}/${encodeURIComponent(DEFAULT_IMAGE_MODEL)}`, {
        method: 'GET',
        headers: { 'x-goog-api-key': apiKey },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const statusCode = response.status === 401 || response.status === 403 ? 401
          : response.status === 429 ? 429
            : 502;
        throw Object.assign(new Error('Gemini key validation failed.'), { statusCode });
      }
      return result(200, { valid: true });
    }

    if (pathname === '/api/infographic-agent/prepare') {
      const topic = cleanText(body?.topic || body?.text, 20000);
      const mode = cleanText(body?.mode, 40) || 'data-story';
      const aspect = cleanText(body?.aspect, 20) || '16:9';
      const instructions = cleanText(body?.instructions, 2000);

      if (!topic) {
        return result(400, { error: 'Topic or content text is required.' });
      }

      const promptDirective = `Create an infographic plan and image generation prompt for:
Topic: ${topic}
Visual Mode: ${mode} (${MODES[mode] || 'General infographic layout'})
Aspect Ratio: ${aspect}
${instructions ? `Additional Style Instructions: ${instructions}` : ''}

Output valid JSON adhering to the schema.`;

      const interaction = await createInteraction({
        apiKey,
        model: ORCHESTRATOR_MODEL,
        input: [
          { type: 'text', text: RESEARCH_SYSTEM_PROMPT },
          { type: 'text', text: promptDirective },
        ],
        thinkingConfig: { thinking_level: 'LOW' },
        fetchImpl,
        signal,
      });

      const responseText = outputText(interaction);
      let parsed;
      try {
        parsed = parseJsonText(responseText);
      } catch {
        return result(502, { error: 'Failed to parse model research output as JSON.', raw: responseText });
      }

      return result(200, {
        analysis: parsed.analysis || {},
        prompt: parsed.prompt || '',
        mode,
        aspect,
      });
    }

    if (pathname === '/api/infographic-agent/render') {
      const prompt = cleanText(body?.prompt, 4000);
      const mode = cleanText(body?.mode, 40) || 'data-story';
      const aspect = cleanText(body?.aspect, 20) || '16:9';
      const requestedModel = cleanText(body?.imageModel, 60);
      const imageModel = ALLOWED_IMAGE_MODELS.has(requestedModel) ? requestedModel : DEFAULT_IMAGE_MODEL;
      const previousImage = parseDataUrl(body?.previousImageBase64);
      const editInstruction = cleanText(body?.editInstruction, 1000);

      if (!prompt && !editInstruction) {
        return result(400, { error: 'A prompt or edit instruction is required.' });
      }

      let renderPromptText = prompt;
      if (editInstruction && previousImage) {
        renderPromptText = `Edit the provided infographic image according to this instruction: ${editInstruction}. Maintain high visual quality, clear typography, correct data points, and the ${aspect} aspect ratio.`;
      }

      const input = [
        ...(previousImage ? [previousImage] : []),
        { type: 'text', text: renderPromptText },
      ];

      const interaction = await createInteraction({
        apiKey,
        model: imageModel,
        input,
        fetchImpl,
        signal,
      });

      const imageBlock = outputImage(interaction);
      if (!imageBlock) {
        const text = outputText(interaction);
        return result(502, {
          error: 'Model did not return an image. It may have refused the prompt or returned text only.',
          text,
        });
      }

      return result(200, {
        image: `data:${imageBlock.mime_type};base64,${imageBlock.data}`,
        mimeType: imageBlock.mime_type,
        model: imageModel,
        aspect,
        mode,
      });
    }

    return result(404, { error: 'Unknown infographic-agent API route.' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return result(statusCode, {
      error: error.message || 'Infographic Agent API request failed.',
      code: statusCode === 429 ? 'RATE_LIMITED' : 'INFOGRAPHIC_AGENT_ERROR',
      details: error.details,
    });
  }
}
