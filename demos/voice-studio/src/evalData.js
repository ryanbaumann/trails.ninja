export const EVAL_PROMPTS = [
  {
    id: "eval_01",
    task: "Edit",
    prompt: "Rewrite this corporate draft in Ryan's voice: We are pleased to announce our platform.",
    groundTruth: "We shipped the platform today. Here is what it does and where the edges are.",
    baseModel: "We are thrilled to unveil our cutting-edge platform, designed to revolutionize developer workflows and empower teams to seamlessly scale.",
    round1Model: "We shipped the platform today. Here is what you can build with it.",
    context: "Corporate launch announcement"
  },
  {
    id: "eval_02",
    task: "Edit",
    prompt: "Rewrite this announcement: Our engineering team has deployed an innovative solution to enhance system availability.",
    groundTruth: "We fixed the failover loop in production. Uptime is back where it belongs.",
    baseModel: "Our dedicated engineering team has successfully deployed an innovative, robust solution to significantly enhance overall system availability and uptime.",
    round1Model: "We deployed the fix to keep the system up under peak load.",
    context: "Infrastructure reliability note"
  },
  {
    id: "eval_03",
    task: "Edit",
    prompt: "Rewrite this messy voice memo into clean prose: so um basically what happened was we saw the traces were blowing up because of an extra field mask on place details and it quadrupled our bills.",
    groundTruth: "We watched our trace volume spike because someone added an extra field mask to Place Details. That single parameter quadrupled our bill before we caught it in staging.",
    baseModel: "In essence, an unexpected situation arose where our trace volume increased exponentially due to the inclusion of an extraneous field mask on place details, which consequently led to a fourfold increase in billing expenses.",
    round1Model: "We saw our traces blow up because of an unconstrained field mask on Place Details, quadrupling the API bill overnight.",
    context: "Field note on Google Maps API billing shock"
  },
  {
    id: "eval_04",
    task: "Critique",
    prompt: "Critique this draft opening: In today's fast-paced digital world, developers face numerous challenges with API integrations.",
    groundTruth: "The opening relies on a universal cliché. Cut the throat-clearing preamble and start with the specific broken API call or developer friction.",
    baseModel: "This is a solid opening that establishes the context well. You could consider adding more descriptive adjectives to emphasize the complexity of modern software ecosystems.",
    round1Model: "This draft opens with generic filler. Replace 'In today's fast-paced world' with the actual developer friction: show the broken trace or the specific integration failure first.",
    context: "Editorial critique on rhetorical throat-clearing"
  },
  {
    id: "eval_05",
    task: "Critique",
    prompt: "Critique this case study section: ## The Hypothesis\nIt is hypothesized that developer experience improvements yield higher user retention.\n## The Methodology\nWe leveraged resources to conduct a comprehensive audit.",
    groundTruth: "This reads like an academic lab report. Replace 'The Hypothesis' with the friction developers felt, and replace 'leveraged resources' with the exact tools and commands you ran.",
    baseModel: "The structure is logical and scientific. You may want to expand on the methodology by enumerating each step in a detailed bulleted list.",
    round1Model: "This section is trapped in passive academic jargon. Swap the theoretical headings for the concrete result: what broke, what shipped, and what the logs proved.",
    context: "Diagnostic critique on academic tone"
  },
  {
    id: "eval_06",
    task: "Headline",
    prompt: "Generate headline variants for an article on why prompt engineering hits an RLHF ceiling.",
    groundTruth: "1. Prompt Engineering Has a Ceiling: Why We Fine-Tuned Gemma 4\n2. When Prompts Plateau: Moving From Context to Weights\n3. You Cannot Prompt Away RLHF Mean Regression",
    baseModel: "1. The Ultimate Guide to Prompt Engineering\n2. Unlocking LLM Potential Beyond the RLHF Horizon\n3. Revolutionizing AI: How to Overcome Prompting Limitations",
    round1Model: "1. Why Prompt Engineering Hits an RLHF Ceiling\n2. Moving From Prompt Scaffolding to Learned Weights\n3. The Limits of In-Context Steering in Production",
    context: "Technical essay headline generation"
  },
  {
    id: "eval_07",
    task: "Headline",
    prompt: "Generate headline variations for a post about why autonomous agents spin when given unconstrained loops.",
    groundTruth: "1. Autonomous Agents Spin When Loops Lack Hard Stop Rules\n2. The Accidental Complexity of Open-Ended Agent Loops\n3. Why Your Agent Spun for 40 Turns on a One-Line Fix",
    baseModel: "1. Mastering Agentic AI: Avoiding Infinite Loops in Modern Autonomous Systems\n2. The Future of AI Agents: Overcoming Autonomous Obstacles\n3. Efficient Agent Design Patterns for 2026",
    round1Model: "1. Why Autonomous Agents Spin in Unconstrained Loops\n2. The 3-Strike Rule: Stopping Agent Loops Before They Burn Token Budgets\n3. What Happens When an Agent Runs Without a Done Condition",
    context: "Agent engineering design principles"
  },
  {
    id: "eval_08",
    task: "Draft",
    prompt: "Write a short Field Note on why local fine-tuning on Apple Silicon changes personal developer workflows.",
    groundTruth: "Running QLoRA locally on an M4 Pro transforms how you iterate on models. When fine-tuning takes five minutes on unified memory instead of twenty minutes waiting on a cloud GPU queue, you treat training like compilation. You try smaller experiments, test tighter datasets, and keep proprietary drafts on-device.",
    baseModel: "In recent years, Apple Silicon has emerged as a groundbreaking paradigm for machine learning practitioners. By leveraging unified memory architecture, developers can now seamlessly execute parameter-efficient fine-tuning locally, thereby fostering unparalleled productivity and cost-effectiveness.",
    round1Model: "Fine-tuning locally on Apple Silicon changes your feedback loop. When an adapter trains in six minutes on Metal with zero cloud bills, you stop treating model training as an expensive deployment and start treating it like local unit tests.",
    context: "Field Note on local ML tooling"
  }
];

export const TRAINING_RUNS = [
  {
    round: "Round 1 (Baseline QLoRA)",
    model: "Gemma 4 26B-A4B (4-bit OptiQ)",
    lossStart: 11.905,
    lossEnd: 0.437,
    peakMemory: "36.8 GB",
    lossHistory: [
      { iter: 1, valLoss: 11.905, trainLoss: null },
      { iter: 50, valLoss: 1.181, trainLoss: 1.375 },
      { iter: 100, valLoss: 0.829, trainLoss: 0.684 },
      { iter: 150, valLoss: 0.760, trainLoss: 0.246 },
      { iter: 200, valLoss: 0.725, trainLoss: 0.153 },
      { iter: 250, valLoss: 0.655, trainLoss: 0.103 },
      { iter: 300, valLoss: 0.523, trainLoss: 0.074 },
      { iter: 350, valLoss: 0.477, trainLoss: 0.075 },
      { iter: 400, valLoss: 0.677, trainLoss: 0.049 },
      { iter: 468, valLoss: 0.437, trainLoss: 0.021 }
    ],
    notes: "Full dataset (159 examples), unmasked prompt loss. Reached 0.437 val loss but experienced prompt repetition on zero-shot edit tasks."
  },
  {
    round: "Round 2 (Masked Prompt + Pre-Chunked)",
    model: "Gemma 4 26B-A4B (4-bit OptiQ)",
    lossStart: 10.099,
    lossEnd: 0.312,
    peakMemory: "23.8 GB",
    lossHistory: [
      { iter: 1, valLoss: 10.099, trainLoss: null },
      { iter: 25, valLoss: 1.420, trainLoss: 2.150 },
      { iter: 50, valLoss: 0.790, trainLoss: 0.890 },
      { iter: 75, valLoss: 0.580, trainLoss: 0.420 },
      { iter: 100, valLoss: 0.490, trainLoss: 0.280 },
      { iter: 150, valLoss: 0.380, trainLoss: 0.140 },
      { iter: 200, valLoss: 0.330, trainLoss: 0.090 },
      { iter: 250, valLoss: 0.312, trainLoss: 0.065 }
    ],
    notes: "Pre-chunked <=2048 tokens, --mask-prompt (completion-only loss), grad_accum=4. Memory dropped by 13GB with pristine register transfer."
  },
  {
    round: "Round 3 (Sweet-Spot 100 Iters)",
    model: "Gemma 4 26B-A4B (4-bit OptiQ)",
    lossStart: 10.099,
    lossEnd: 1.751,
    peakMemory: "29.8 GB",
    lossHistory: [
      { iter: 1, valLoss: 10.099, trainLoss: null },
      { iter: 20, valLoss: 2.366, trainLoss: 2.220 },
      { iter: 40, valLoss: 1.851, trainLoss: 1.858 },
      { iter: 60, valLoss: 1.992, trainLoss: 1.283 },
      { iter: 80, valLoss: 1.766, trainLoss: 0.544 },
      { iter: 100, valLoss: 1.751, trainLoss: 1.270 }
    ],
    notes: "100 iterations (2.5 epochs), lr=5e-5, grad_accum=2. Preserves stylistic flexibility and avoids mode collapse on open-ended tasks."
  },
  {
    round: "Round 4 (218 Micro-Pairs Augmented)",
    model: "Gemma 4 26B-A4B (4-bit OptiQ)",
    lossStart: 10.099,
    lossEnd: 1.450,
    peakMemory: "24.5 GB",
    lossHistory: [
      { iter: 1, valLoss: 10.099, trainLoss: null },
      { iter: 25, valLoss: 2.150, trainLoss: 1.950 },
      { iter: 50, valLoss: 1.720, trainLoss: 1.410 },
      { iter: 75, valLoss: 1.580, trainLoss: 0.980 },
      { iter: 100, valLoss: 1.490, trainLoss: 0.720 },
      { iter: 150, valLoss: 1.450, trainLoss: 0.510 }
    ],
    notes: "Expanded 218-sample dataset with paragraph-level micro-pairs (111 Edits, 54 Drafts, 30 Critiques, 19 Headlines), lr=8e-5."
  }
];
