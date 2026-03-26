const axios = require("axios");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5";

function stripCodeFence(text) {
  return String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function chat({ messages, format, options } = {}) {
  const response = await axios.post(
    OLLAMA_URL,
    {
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      format,
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

  return content.trim();
}

async function chatJson({ messages, options } = {}) {
  const content = await chat({
    messages,
    format: "json",
    options
  });

  return JSON.parse(stripCodeFence(content));
}

module.exports = { chat, chatJson };
