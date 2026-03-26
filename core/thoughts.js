const { readJson, writeJson } = require("./store");

const THOUGHTS_PATH = "memory/thoughts.json";
const MAX_THOUGHTS = 400;

function defaultThoughts() {
  return [];
}

function readThoughts() {
  const thoughts = readJson(THOUGHTS_PATH, defaultThoughts());
  return Array.isArray(thoughts) ? thoughts : [];
}

function writeThoughts(thoughts) {
  writeJson(THOUGHTS_PATH, thoughts.slice(-MAX_THOUGHTS), defaultThoughts());
}

function logThought(entry) {
  const thoughts = readThoughts();
  thoughts.push({
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    taskId: entry.taskId || null,
    mode: entry.mode || "fast",
    agent: entry.agent || "system",
    text: entry.text || "",
    score: entry.score ?? null,
    confidence: entry.confidence ?? null,
    createdAt: Date.now()
  });

  writeThoughts(thoughts);
}

function getThoughts({ since = 0, taskId } = {}) {
  const numericSince = Number.parseInt(String(since || 0), 10) || 0;

  return readThoughts().filter((thought) => {
    if (thought.createdAt <= numericSince) {
      return false;
    }

    if (taskId && thought.taskId !== taskId) {
      return false;
    }

    return true;
  });
}

module.exports = {
  getThoughts,
  logThought
};
