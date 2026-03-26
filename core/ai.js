const axios = require("axios");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5";
const DEFAULT_KEEP_ALIVE = -1;

function stripCodeFence(text) {
  return String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function chat({ messages, format, options, keepAlive = DEFAULT_KEEP_ALIVE } = {}) {
  const startedAt = Date.now();
  const response = await axios.post(
    OLLAMA_URL,
    {
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      format,
      keep_alive: keepAlive,
      options: {
        temperature: 0.2,
        ...options
      }
    },
    {
      timeout: 60000,
      maxBodyLength: 1024 * 1024
    }
  );

  const content = response.data?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Ollama response did not contain message content");
  }

  const finishedAt = Date.now();

  return {
    content: content.trim(),
    metrics: {
      ttftMs: finishedAt - startedAt,
      totalMs: finishedAt - startedAt
    }
  };
}

async function chatText(config = {}) {
  const result = await chat(config);
  return result.content;
}

async function chatJson({ messages, options, keepAlive } = {}) {
  const result = await chat({
    messages,
    format: "json",
    options,
    keepAlive
  });

  return {
    data: JSON.parse(stripCodeFence(result.content)),
    metrics: result.metrics
  };
}

async function warmupModel() {
  return chat({
    messages: [
      {
        role: "user",
        content: "hello"
      }
    ],
    options: {
      temperature: 0
    },
    keepAlive: -1
  });
}

module.exports = {
  OLLAMA_MODEL,
  chat,
  chatJson,
  chatText,
  warmupModel
};
