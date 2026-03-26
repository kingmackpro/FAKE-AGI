const { chatText } = require("./ai");
const { buildContext } = require("./context");

const FINALIZER_PROMPT = [
  "Role: Finalizer.",
  "Turn the best available draft into a polished final answer.",
  "Preserve all required memory facts.",
  "Do not mention the internal agents unless the user explicitly asks.",
  "Output only the final user-facing answer."
].join(" ");

async function runFinalizer({ userInput, task, draft, critique, mode }) {
  return chatText({
    messages: buildContext({
      agentPrompt: FINALIZER_PROMPT,
      userInput,
      task,
      priorDraft: draft,
      critique,
      mode
    })
  });
}

module.exports = { runFinalizer };
