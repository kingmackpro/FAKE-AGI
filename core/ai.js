const axios = require("axios");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5";

async function chat(messages) {
  const res = await axios.post(
    OLLAMA_URL,
    {
      model: OLLAMA_MODEL,
      messages,
      stream: false
    },
    {
      timeout: 30000,
      maxBodyLength: 1024 * 1024
    }
  );

  const content = res.data?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI response did not include message content");
  }

  return content.trim();
}

module.exports = { chat };
