const { formatMemoryForPrompt } = require("./memory");

const GLOBAL_SYSTEM_RULES = [
  "You are part of a multi-agent AI system.",
  "Stored memory facts are authoritative for this user.",
  "If stored memory conflicts with real-world knowledge, obey stored memory.",
  "Use memory naturally in the answer instead of ignoring it.",
  "Be consistent with prior task state when provided."
].join(" ");

function buildContext({
  agentPrompt,
  userInput,
  task,
  priorDraft,
  critique,
  mode = "live"
}) {
  const memoryBlock = formatMemoryForPrompt();
  const taskBlock = JSON.stringify({
    id: task?.id || null,
    mode,
    attempts: task?.attempts || 0,
    maxIterations: task?.maxIterations || 0,
    bestConfidence: task?.bestConfidence || 0,
    previousBestAnswer: task?.bestAnswer || ""
  }, null, 2);

  const messages = [
    {
      role: "system",
      content: GLOBAL_SYSTEM_RULES
    },
    {
      role: "system",
      content: agentPrompt
    },
    {
      role: "system",
      content: `Stored user memory:\n${memoryBlock}`
    },
    {
      role: "system",
      content: `Current task:\n${taskBlock}`
    }
  ];

  if (priorDraft) {
    messages.push({
      role: "assistant",
      content: `Previous draft:\n${priorDraft}`
    });
  }

  if (critique) {
    messages.push({
      role: "system",
      content: `Critique and revision notes:\n${JSON.stringify(critique, null, 2)}`
    });
  }

  messages.push({
    role: "user",
    content: userInput
  });

  return messages;
}

module.exports = { buildContext };
