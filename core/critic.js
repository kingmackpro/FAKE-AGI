const { chatJson } = require("./ai");
const { buildContext } = require("./context");

const CRITIC_PROMPT = [
  "Role: Critic.",
  "Review the draft answer for factual consistency with stored memory, completeness, clarity, and usefulness.",
  "You must catch any case where the draft ignored user memory.",
  'Return strict JSON: {"score":0-100,"confidence":0-100,"issues":["..."],"improved_answer":"...","should_continue":true}'
].join(" ");

async function runCritic({ userInput, task, draft, mode }) {
  const result = await chatJson({
    messages: buildContext({
      agentPrompt: CRITIC_PROMPT,
      userInput,
      task,
      priorDraft: draft,
      mode
    }),
    options: {
      temperature: 0
    }
  });

  return {
    score: Math.max(0, Math.min(100, Number.parseInt(String(result.score || 0), 10) || 0)),
    confidence: Math.max(0, Math.min(100, Number.parseInt(String(result.confidence || 0), 10) || 0)),
    issues: Array.isArray(result.issues) ? result.issues : [],
    improvedAnswer: String(result.improved_answer || draft).trim(),
    shouldContinue: result.should_continue !== false
  };
}

module.exports = { runCritic };
