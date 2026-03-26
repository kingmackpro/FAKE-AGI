const { chat } = require("./ai");

const SIMPLE_CHAT_PATTERNS = [
  /^(hi|hey|hello|yo|sup)$/i,
  /^(thanks|thank you|ok|okay|cool|nice|great)$/i,
  /^(yes|no|maybe)$/i
];

const DEEP_REASONING_PATTERNS = [
  /\b(compare|analy[sz]e|reason|plan|design|debug|fix|improve|refactor|strategy)\b/i,
  /\bwhy\b/i,
  /\bhow\b/i,
  /\bstep by step\b/i,
  /\bpros and cons\b/i,
  /\barchitecture\b/i
];

const MEMORY_PATTERNS = [
  /^([^=\n]{1,80})\s*=\s*([^=\n]{1,120})$/i,
  /^remember\s+(?:that\s+)?/i
];

function deterministicClassification(userInput) {
  const text = String(userInput || "").trim();

  if (!text) {
    return "NO";
  }

  if (SIMPLE_CHAT_PATTERNS.some((pattern) => pattern.test(text))) {
    return "NO";
  }

  if (MEMORY_PATTERNS.some((pattern) => pattern.test(text))) {
    return "NO";
  }

  if (text.length < 20 && !text.includes("?")) {
    return "NO";
  }

  if (DEEP_REASONING_PATTERNS.some((pattern) => pattern.test(text))) {
    return "YES";
  }

  if (text.length > 140) {
    return "YES";
  }

  return null;
}

async function classifyProblem(userInput) {
  const deterministic = deterministicClassification(userInput);
  if (deterministic) {
    return deterministic;
  }

  const result = await chat({
    messages: [
      {
        role: "system",
        content: [
          "Classify whether the user's message needs deep background reasoning.",
          "Return only YES or NO.",
          "YES only for complex tasks that benefit from deeper offline improvement.",
          "NO for greetings, normal chat, simple answers, and memory statements."
        ].join(" ")
      },
      {
        role: "user",
        content: userInput
      }
    ],
    options: {
      temperature: 0
    }
  });

  return /\bYES\b/i.test(result) ? "YES" : "NO";
}

module.exports = { classifyProblem };
