const { chatText } = require("./ai");

const SIMPLE_CHAT_PATTERNS = [
  /^(hi|hey|hello|yo|sup)$/i,
  /^(thanks|thank you|ok|okay|cool|nice|great)$/i,
  /^(yes|no|maybe)$/i
];

const MEMORY_PATTERNS = [
  /^([^=\n]{1,80})\s*=\s*([^=\n]{1,120})$/i,
  /^remember\s+(?:that\s+)?/i
];

const COMPLEX_PATTERNS = [
  /\bcompare\b/i,
  /\bdebug\b/i,
  /\brefactor\b/i,
  /\bstrategy\b/i,
  /\barchitecture\b/i,
  /\bprove\b/i,
  /\banaly[sz]e\b/i,
  /\bstep by step\b/i,
  /\bpros and cons\b/i
];

const MEDIUM_PATTERNS = [
  /\bhow\b/i,
  /\bwhy\b/i,
  /\bexplain\b/i,
  /\bhelp me\b/i,
  /\bwhat is\b/i
];

function deterministicClassification(userInput) {
  const text = String(userInput || "").trim();

  if (!text) {
    return "SIMPLE";
  }

  if (SIMPLE_CHAT_PATTERNS.some((pattern) => pattern.test(text))) {
    return "SIMPLE";
  }

  if (MEMORY_PATTERNS.some((pattern) => pattern.test(text))) {
    return "SIMPLE";
  }

  if (COMPLEX_PATTERNS.some((pattern) => pattern.test(text))) {
    return "COMPLEX";
  }

  if (text.length > 220) {
    return "COMPLEX";
  }

  if (MEDIUM_PATTERNS.some((pattern) => pattern.test(text))) {
    return "MEDIUM";
  }

  if (text.length < 20 && !text.includes("?")) {
    return "SIMPLE";
  }

  return null;
}

async function classifyMessage(userInput) {
  const deterministic = deterministicClassification(userInput);
  if (deterministic) {
    return deterministic;
  }

  const result = await chatText({
    messages: [
      {
        role: "system",
        content: [
          "Classify the user's message into exactly one of these labels:",
          "SIMPLE, MEDIUM, COMPLEX.",
          "Return only the label.",
          "SIMPLE means quick direct reply only.",
          "MEDIUM means one-pass mini multi-agent fast pipeline.",
          "COMPLEX means deep background task is justified."
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

  const normalized = String(result).trim().toUpperCase();
  if (normalized.includes("COMPLEX")) {
    return "COMPLEX";
  }

  if (normalized.includes("MEDIUM")) {
    return "MEDIUM";
  }

  return "SIMPLE";
}

function classifyProblem(userInput) {
  return classifyMessage(userInput).then((level) => (level === "COMPLEX" ? "YES" : "NO"));
}

module.exports = { classifyMessage, classifyProblem };
