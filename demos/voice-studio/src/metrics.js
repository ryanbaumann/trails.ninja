// Real-time Voice & Style Metrics Analyzer
const BANNED_BUZZWORDS = [
  "excited to announce",
  "pleased to announce",
  "thrilled to announce",
  "game-changer",
  "revolutionize",
  "leverage",
  "seamlessly",
  "cutting-edge",
  "paradigm shift",
  "delve into",
  "it is important to remember",
  "it's important to note",
  "foster collaboration",
  "synergy",
  "unparalleled",
  "in today's digital world",
  "in today's fast-paced"
];

export function analyzeVoiceMetrics(text) {
  if (!text || typeof text !== "string") {
    return {
      wordCount: 0,
      sentenceCount: 0,
      avgSentenceLength: 0,
      sentenceLengthStdev: 0,
      emDashCount: 0,
      buzzwords: [],
      contractionsCount: 0,
      hallucinatedMetrics: [],
      sentenceLengths: []
    };
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Split into sentences
  const rawSentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("#") && !s.startsWith("```"));

  const sentenceLengths = rawSentences.map(s => s.split(/\s+/).filter(Boolean).length).filter(l => l > 0);
  const sentenceCount = sentenceLengths.length;

  let avgSentenceLength = 0;
  let sentenceLengthStdev = 0;

  if (sentenceCount > 0) {
    avgSentenceLength = Math.round((wordCount / sentenceCount) * 10) / 10;
    if (sentenceCount > 1) {
      const variance = sentenceLengths.reduce((acc, len) => acc + Math.pow(len - avgSentenceLength, 2), 0) / sentenceCount;
      sentenceLengthStdev = Math.round(Math.sqrt(variance) * 10) / 10;
    }
  }

  // Em-dash count (— or --)
  const emDashMatches = text.match(/—|--/g);
  const emDashCount = emDashMatches ? emDashMatches.length : 0;

  // Buzzword scan
  const lower = text.toLowerCase();
  const buzzwords = [];
  for (const bw of BANNED_BUZZWORDS) {
    if (lower.includes(bw)) {
      buzzwords.push(bw);
    }
  }

  // Contraction count
  const contractionMatches = text.match(/\b\w+['’](?:t|s|re|ve|d|ll|m)\b/gi);
  const contractionsCount = contractionMatches ? contractionMatches.length : 0;

  // Percent / Metric check
  const percentMatches = text.match(/\b\d+(?:\.\d+)?%\b/g);
  const hallucinatedMetrics = percentMatches ? Array.from(new Set(percentMatches)) : [];

  return {
    wordCount,
    sentenceCount,
    avgSentenceLength,
    sentenceLengthStdev,
    emDashCount,
    buzzwords,
    contractionsCount,
    hallucinatedMetrics,
    sentenceLengths
  };
}
