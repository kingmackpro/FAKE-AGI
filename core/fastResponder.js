const { chat } = require("./ai");
const { buildContext } = require("./context");

const FAST_RESPONDER_PROMPT = [
  "Role: Fast responder.",
  "Reply quickly and naturally.",
  "Use stored memory when relevant.",
  "Do not perform long internal deliberation.",
  "Give a concise helpful answer."
].join(" ");

async function runFastResponder({ userInput, task }) {
  return chat({
    messages: buildContext({
      agentPrompt: FAST_RESPONDER_PROMPT,
      userInput,
      task,
      mode: "fast"
    }),
    options: {
      temperature: 0.3
    }
  });
}

module.exports = { runFastResponder };
