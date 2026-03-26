const { chatJson } = require("./ai");
const { readJson, writeJson } = require("./store");

const LONGTERM_PATH = "memory/longterm.json";
const MAX_FACTS = 200;
const MAX_INTERACTIONS = 40;
const MAX_UPDATES = 40;

function defaultLongtermMemory() {
  return {
    facts: {},
    interactions: [],
    updates: []
  };
}

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase();
}

function getLongtermMemory() {
  return readJson(LONGTERM_PATH, defaultLongtermMemory());
}

function saveLongtermMemory(memory) {
  writeJson(LONGTERM_PATH, memory, defaultLongtermMemory());
}

function getFactEntries() {
  const memory = getLongtermMemory();
  return Object.entries(memory.facts || {});
}

function formatMemoryForPrompt() {
  const factEntries = getFactEntries();
  if (!factEntries.length) {
    return "No stored user facts yet.";
  }

  return factEntries
    .slice(-MAX_FACTS)
    .map(([key, value]) => `- ${key} = ${value.value}`)
    .join("\n");
}

function extractFactsWithRegex(userInput) {
  const facts = [];
  const text = String(userInput || "").trim();

  const equalMatch = text.match(/^([^=\n]{1,80})\s*=\s*([^=\n]{1,120})$/);
  if (equalMatch) {
    facts.push({
      key: equalMatch[1].trim(),
      value: equalMatch[2].trim(),
      source: "regex"
    });
  }

  const rememberMatch = text.match(/^remember\s+(?:that\s+)?(.+?)\s+is\s+(.+)$/i);
  if (rememberMatch) {
    facts.push({
      key: rememberMatch[1].trim(),
      value: rememberMatch[2].trim(),
      source: "regex"
    });
  }

  return facts;
}

async function extractFactsWithModel(userInput) {
  try {
    const result = await chatJson({
      messages: [
        {
          role: "system",
          content: [
            "Extract explicit user-defined memory facts from the message.",
            "Only capture facts the user wants remembered.",
            "Do not infer hidden facts.",
            'Return JSON: {"facts":[{"key":"...", "value":"..."}]}'
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

    if (!Array.isArray(result.facts)) {
      return [];
    }

    return result.facts
      .filter((fact) => fact && fact.key && fact.value)
      .map((fact) => ({
        key: String(fact.key).trim(),
        value: String(fact.value).trim(),
        source: "model"
      }));
  } catch (error) {
    return [];
  }
}

async function extractFacts(userInput) {
  const deterministicFacts = extractFactsWithRegex(userInput);
  const modelFacts = await extractFactsWithModel(userInput);
  const deduped = new Map();

  for (const fact of deterministicFacts.concat(modelFacts)) {
    const key = normalizeKey(fact.key);
    if (!key || !fact.value) {
      continue;
    }

    deduped.set(key, {
      key,
      value: String(fact.value).trim(),
      source: fact.source
    });
  }

  return Array.from(deduped.values());
}

function storeFacts(facts, sourceText) {
  if (!facts.length) {
    return [];
  }

  const memory = getLongtermMemory();
  const now = new Date().toISOString();
  const nextFacts = { ...(memory.facts || {}) };

  for (const fact of facts) {
    nextFacts[fact.key] = {
      value: fact.value,
      source: fact.source,
      learnedFrom: sourceText,
      updatedAt: now
    };
  }

  const trimmedEntries = Object.entries(nextFacts).slice(-MAX_FACTS);
  memory.facts = Object.fromEntries(trimmedEntries);
  saveLongtermMemory(memory);

  return facts;
}

async function extractAndStoreFacts(userInput) {
  const facts = await extractFacts(userInput);
  return storeFacts(facts, userInput);
}

function rememberInteraction(entry) {
  const memory = getLongtermMemory();
  const interactions = Array.isArray(memory.interactions) ? memory.interactions : [];

  interactions.push({
    userInput: entry.userInput,
    answer: entry.answer,
    confidence: entry.confidence,
    taskId: entry.taskId || null,
    mode: entry.mode || "live",
    createdAt: new Date().toISOString()
  });

  memory.interactions = interactions.slice(-MAX_INTERACTIONS);
  saveLongtermMemory(memory);
}

function pushUpdate(update) {
  const memory = getLongtermMemory();
  const updates = Array.isArray(memory.updates) ? memory.updates : [];

  updates.push({
    id: `u_${Date.now()}`,
    taskId: update.taskId,
    originalQuestion: update.originalQuestion,
    answer: update.answer,
    confidence: update.confidence,
    createdAt: Date.now()
  });

  memory.updates = updates.slice(-MAX_UPDATES);
  saveLongtermMemory(memory);
}

function getUpdatesSince(since = 0) {
  const memory = getLongtermMemory();
  const updates = Array.isArray(memory.updates) ? memory.updates : [];
  const numericSince = Number.parseInt(String(since || 0), 10) || 0;

  return updates.filter((update) => update.createdAt > numericSince);
}

module.exports = {
  extractAndStoreFacts,
  formatMemoryForPrompt,
  getLongtermMemory,
  getUpdatesSince,
  normalizeKey,
  pushUpdate,
  rememberInteraction
};
