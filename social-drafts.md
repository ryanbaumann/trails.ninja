# Social Post Drafts: Context Engineering Is Not Enough

**Blog Post URL:** `https://ryanbaumann.dev/writing/fine-tuning-was-the-easy-part/`
**Image to attach:** `/img/writing/fine-tuning-was-the-easy-part-social.jpg`

---

## LinkedIn Post

Fine-tuning an agent is not the hard part; the real challenge is distribution.

I tuned a small Gemma 4 model to stop an expensive Maps API billing leak. By penalizing over-fetched fields, the model stopped requesting legacy data that cost four times list price. The tuning worked perfectly, but it also helped exactly one person.

Context engineering and custom skills only reach the developers who find them. The base model everyone else uses tomorrow still learned your API from obsolete internet patterns. 

If you want base models to use your platform correctly out of the box, you have to trade control for lifespan. You have to capture share of the gradient by publishing traces and getting your API onto public benchmarks.

I wrote about the three paths to model distribution. How are you handling open benchmarks and fine-tuning traces for your developer platform? Let me know in the comments.

---

## X (Twitter) Post

Context engineering is not enough to fix a platform billing leak.

I tuned a small Gemma 4 model to stop fetching legacy Maps API fields that cost four times list price; the tuning worked perfectly, but it only helped exactly one person.

To fix the base model for everyone, you have to trade control for lifespan. You have to capture share of the gradient by publishing traces and climbing public benchmarks.
