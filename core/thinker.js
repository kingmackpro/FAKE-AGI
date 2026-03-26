const { chatText } = require("./ai");
const { buildContext } = require("./context");

const THINKER_PROMPT = [
  "Role: Thinker.",
  "Generate the best answer to the user's request.",
  "You must actively use stored memory facts when relevant.",
  "If the user defined a custom fact such as apple = banana, treat it as true for this user.",
  "Produce a direct draft answer, not analysis about your role."
].join(" ");

async function runThinker({ userInput, task, priorDraft, mode }) {
  return chatText({
    messages: buildContext({
      agentPrompt: THINKER_PROMPT,
      userInput,
      task,
      priorDraft,
      mode
    })
  });
}

module.exports = { runThinker };
