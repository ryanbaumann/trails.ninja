# Social Post Drafts: I Fine-Tuned the Model Before I Built the Test

**Blog Post URL:** `https://ryanbaumann.dev/writing/fine-tuning-was-the-easy-part/`
**Image to attach:** `/img/writing/the-eval-failed-before-the-model-did-social.jpg`

---

## LinkedIn Post

The first eval case in my fine-tuning experiment had the wrong answer. The evaluator underneath it never called a model.

I found that while checking a post that said a small Gemma model had moved from 18% to 94% exact match. What the repository actually had was ten cases, no holdout, no retained outputs, and four scores typed into source.

The training run itself completed 100 LoRA steps and reached 0.028 validation loss. That number was real. Everything I had written about task performance went past the evidence.

I rewrote the Field Note around the run I actually have and the eval I need to build next. For one failed request, I should be able to see the exact model, prompt, raw output, and each grader result. If I can't follow the score back to behavior, I don't have a result I can debug.

If you know a public eval that does this well, send it my way. That is the bar for the rerun.

---

## X (Twitter) Post

I fine-tuned the model before I built the test.

The run reached 0.028 validation loss. The repo had ten cases, no holdout, one wrong answer key, zero retained outputs, and four scores typed into source.

I rewrote the post around what the experiment actually proved.
