const { classifyProblem } = require("./classifier");
const { runCritic } = require("./critic");
const { runFastResponder } = require("./fastResponder");
const { runFinalizer } = require("./finalizer");
const { extractAndStoreFacts, pushUpdate, rememberInteraction, removeTaskMemory } = require("./memory");
const {
  completeTask,
  enqueueImprovementTask,
  getLatestActiveTask,
  getNextQueuedTask,
  listActiveTasks,
  removeTask,
  updateTaskStatus,
  writeTask
} = require("./taskManager");
const { logThought, removeTaskThoughts } = require("./thoughts");
const { runThinker } = require("./thinker");

const TARGET_CONFIDENCE = 90;
const TARGET_SCORE = 90;
const MAX_STAGNANT_ITERATIONS = 2;
const STOP_PATTERNS = [
  /\bstop working on that\b/i,
  /\bforget that problem\b/i,
  /\bcancel that task\b/i,
  /\bi don't need that anymore\b/i,
  /\bstop that\b/i,
  /\bcancel\b/i,
  /\bforget that\b/i
];
const PAUSE_PATTERNS = [
  /\bpause that\b/i,
  /\bpause the task\b/i,
  /\bhold off on that\b/i
];
const RESUME_PATTERNS = [
  /\bresume that\b/i,
  /\bcontinue that\b/i,
  /\bstart that again\b/i,
  /\bresume the task\b/i
];
const PROGRESS_PATTERNS = [
  /\bwhat did you do so far\b/i,
  /\bhow far did you get\b/i,
  /\bprogress\b/i,
  /\bstatus of that\b/i
];
const STOPWORDS = new Set([
  "the", "a", "an", "that", "this", "on", "of", "for", "to", "and", "or",
  "please", "task", "problem", "work", "working", "resume", "pause", "cancel",
  "stop", "forget", "what", "did", "you", "so", "far", "how", "get", "i", "need",
  "dont", "don't", "anymore"
]);

function naturalFollowUpMessage(classification, taskId) {
  if (classification === "YES" && taskId) {
    return "I'll keep working on a stronger answer for you in the background.";
  }

  return null;
}

function logAgent(taskId, mode, agent, text, extra = {}) {
  logThought({
    taskId,
    mode,
    agent,
    text,
    score: extra.score,
    confidence: extra.confidence
  });
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token));
}

function scoreTaskMatch(userInput, task) {
  const inputTokens = tokenize(userInput);
  const taskTokens = new Set(tokenize(task.userInput));
  let score = 0;

  for (const token of inputTokens) {
    if (taskTokens.has(token)) {
      score += 1;
    }
  }

  if (String(userInput).toLowerCase().includes(String(task.userInput).toLowerCase())) {
    score += 5;
  }

  return score;
}

function resolveTaskFromMessage(userInput, statuses) {
  const tasks = listActiveTasks().filter((task) => {
    if (!Array.isArray(statuses) || !statuses.length) {
      return true;
    }

    return statuses.includes(task.status);
  });
  if (!tasks.length) {
    return null;
  }

  let bestTask = null;
  let bestScore = 0;

  for (const task of tasks) {
    const score = scoreTaskMatch(userInput, task);
    if (score > bestScore) {
      bestScore = score;
      bestTask = task;
    }
  }

  if (bestTask && bestScore > 0) {
    return bestTask;
  }

  const latestTask = getLatestActiveTask();
  if (!latestTask) {
    return null;
  }

  if (Array.isArray(statuses) && statuses.length && !statuses.includes(latestTask.status)) {
    return null;
  }

  return latestTask;
}

function detectCommandIntent(userInput) {
  if (STOP_PATTERNS.some((pattern) => pattern.test(userInput))) {
    return "cancel";
  }

  if (PAUSE_PATTERNS.some((pattern) => pattern.test(userInput))) {
    return "pause";
  }

  if (RESUME_PATTERNS.some((pattern) => pattern.test(userInput))) {
    return "resume";
  }

  if (PROGRESS_PATTERNS.some((pattern) => pattern.test(userInput))) {
    return "progress";
  }

  return null;
}

function cancelTaskByMessage(userInput) {
  const task = resolveTaskFromMessage(userInput, ["queued", "running", "paused"]);
  if (!task) {
    return {
      reply: "There isn't an active background task to cancel.",
      queuedTaskId: null,
      followUpMessage: null,
      storedFacts: []
    };
  }

  removeTask(task.id);
  removeTaskMemory(task.id);
  removeTaskThoughts(task.id);

  return {
    reply: `Okay, I stopped working on "${task.userInput}".`,
    queuedTaskId: null,
    followUpMessage: null,
    storedFacts: []
  };
}

function pauseTaskByMessage(userInput) {
  const task = resolveTaskFromMessage(userInput, ["queued", "running"]);
  if (!task) {
    return {
      reply: "There isn't an active background task to pause.",
      queuedTaskId: null,
      followUpMessage: null,
      storedFacts: []
    };
  }

  updateTaskStatus(task.id, "paused");
  logAgent(task.id, "deep", "system", "Task paused by user.");

  return {
    reply: `Paused background work on "${task.userInput}".`,
    queuedTaskId: null,
    followUpMessage: null,
    storedFacts: []
  };
}

function resumeTaskByMessage(userInput) {
  const task = resolveTaskFromMessage(userInput, ["paused"]);
  if (!task) {
    return {
      reply: "There isn't a paused task to resume.",
      queuedTaskId: null,
      followUpMessage: null,
      storedFacts: []
    };
  }

  updateTaskStatus(task.id, "queued");
  logAgent(task.id, "deep", "system", "Task resumed by user.");

  return {
    reply: `Resumed background work on "${task.userInput}".`,
    queuedTaskId: task.id,
    followUpMessage: "I'll continue improving it when deep mode runs again.",
    storedFacts: []
  };
}

function progressTaskByMessage(userInput) {
  const task = resolveTaskFromMessage(userInput, ["queued", "running", "paused"]);
  if (!task) {
    return {
      reply: "There isn't an active task in progress right now.",
      queuedTaskId: null,
      followUpMessage: null,
      storedFacts: []
    };
  }

  const currentBest = task.bestAnswer || "No draft saved yet.";
  const score = task.bestScore ?? 0;
  const iterations = task.attempts ?? 0;

  return {
    reply: `Here's the current progress on "${task.userInput}":\n\ncurrent_best:\n${currentBest}\n\nscore: ${score}\niterations: ${iterations}`,
    queuedTaskId: task.id,
    followUpMessage: null,
    storedFacts: []
  };
}

async function runFastMode({ userInput }) {
  const storedFacts = await extractAndStoreFacts(userInput);
  const reply = await runFastResponder({
    userInput,
    task: {
      id: null,
      attempts: 0,
      maxIterations: 0,
      bestAnswer: "",
      bestConfidence: 0
    }
  });

  logAgent(null, "fast", "fast_responder", reply);

  return {
    answer: reply,
    score: null,
    confidence: null,
    storedFacts
  };
}

async function runDeepMode({ userInput, task }) {
  const storedFacts = await extractAndStoreFacts(userInput);
  const thinkerDraft = await runThinker({
    userInput,
    task,
    priorDraft: task?.bestAnswer || "",
    mode: "deep"
  });
  logAgent(task?.id || null, "deep", "thinker", thinkerDraft);

  const critique = await runCritic({
    userInput,
    task,
    draft: thinkerDraft,
    mode: "deep"
  });
  logAgent(
    task?.id || null,
    "deep",
    "critic",
    critique.improvedAnswer || critique.issues.join("; "),
    {
      score: critique.score,
      confidence: critique.confidence
    }
  );

  const finalAnswer = await runFinalizer({
    userInput,
    task,
    draft: critique.improvedAnswer || thinkerDraft,
    critique,
    mode: "deep"
  });
  logAgent(task?.id || null, "deep", "finalizer", finalAnswer, {
    score: critique.score,
    confidence: critique.confidence
  });

  return {
    answer: finalAnswer,
    score: critique.score,
    confidence: critique.confidence,
    issues: critique.issues,
    shouldContinue: critique.shouldContinue,
    storedFacts
  };
}

async function handleUserMessage(userInput) {
  const commandIntent = detectCommandIntent(userInput);

  if (commandIntent === "cancel") {
    return cancelTaskByMessage(userInput);
  }

  if (commandIntent === "pause") {
    return pauseTaskByMessage(userInput);
  }

  if (commandIntent === "resume") {
    return resumeTaskByMessage(userInput);
  }

  if (commandIntent === "progress") {
    return progressTaskByMessage(userInput);
  }

  const classification = await classifyProblem(userInput);
  logAgent(null, "fast", "classifier", classification);

  const fastResult = await runFastMode({ userInput });

  rememberInteraction({
    userInput,
    answer: fastResult.answer,
    confidence: fastResult.confidence,
    mode: "fast"
  });

  const queuedTaskId = classification === "YES"
    ? enqueueImprovementTask({
        userInput,
        currentAnswer: fastResult.answer,
        confidence: 0,
        score: 0
      })
    : null;

  if (queuedTaskId) {
    logAgent(queuedTaskId, "deep", "system", "Queued for deep background thinking.");
  }

  return {
    reply: fastResult.answer,
    queuedTaskId,
    followUpMessage: naturalFollowUpMessage(classification, queuedTaskId),
    storedFacts: fastResult.storedFacts
  };
}

async function runBackgroundCycle() {
  const task = getNextQueuedTask();
  if (!task) {
    return null;
  }

  task.attempts = (task.attempts || 0) + 1;
  task.status = "running";
  writeTask(task);

  logAgent(task.id, "deep", "system", `Deep mode iteration ${task.attempts} started.`);

  let result;

  try {
    result = await runDeepMode({
      userInput: task.userInput,
      task
    });
  } catch (error) {
    task.failedAttempts = (task.failedAttempts || 0) + 1;
    task.status = task.failedAttempts >= 2 ? "failed" : "queued";
    writeTask(task);

    logAgent(task.id, "deep", "system", `Deep mode failed: ${error.message}`);

    if (task.failedAttempts >= 2) {
      completeTask(task.id);
      return {
        taskId: task.id,
        status: "failed"
      };
    }

    return {
      taskId: task.id,
      status: "queued"
    };
  }

  const improved =
    result.confidence > (task.bestConfidence || 0) ||
    result.score > (task.bestScore || 0) ||
    result.answer !== task.bestAnswer;

  if (improved) {
    task.bestAnswer = result.answer;
    task.bestConfidence = result.confidence;
    task.bestScore = result.score;
    task.stagnantIterations = 0;
    logAgent(task.id, "deep", "system", "Answer improved in this iteration.", {
      score: result.score,
      confidence: result.confidence
    });
  } else {
    task.stagnantIterations = (task.stagnantIterations || 0) + 1;
    logAgent(task.id, "deep", "system", "No meaningful improvement detected.", {
      score: result.score,
      confidence: result.confidence
    });
  }

  task.history = (task.history || []).concat({
    attempt: task.attempts,
    answer: result.answer,
    confidence: result.confidence,
    score: result.score,
    issues: result.issues,
    createdAt: new Date().toISOString()
  });

  const reachedConfidence = result.confidence >= TARGET_CONFIDENCE && result.score >= TARGET_SCORE;
  const reachedMaxIterations = task.attempts >= (task.maxIterations || 4);
  const stagnated = (task.stagnantIterations || 0) >= MAX_STAGNANT_ITERATIONS;

  if (reachedConfidence || reachedMaxIterations || stagnated || !result.shouldContinue) {
    task.status = "completed";
    writeTask(task);

    const finalAnswer = task.bestAnswer || result.answer;
    const finalConfidence = task.bestConfidence || result.confidence;
    const finalScore = task.bestScore || result.score;
    const hasBetterAnswer =
      finalAnswer !== task.initialAnswer ||
      finalConfidence > (task.initialConfidence || 0) ||
      finalScore > (task.initialScore || 0);

    if (hasBetterAnswer) {
      pushUpdate({
        taskId: task.id,
        originalQuestion: task.userInput,
        answer: finalAnswer,
        confidence: finalConfidence
      });
    }

    logAgent(task.id, "deep", "system", "Deep mode finished.", {
      score: finalScore,
      confidence: finalConfidence
    });

    rememberInteraction({
      userInput: task.userInput,
      answer: finalAnswer,
      confidence: finalConfidence,
      taskId: task.id,
      mode: "deep"
    });

    completeTask(task.id);
    return {
      taskId: task.id,
      status: "completed"
    };
  }

  task.status = "queued";
  writeTask(task);
  logAgent(task.id, "deep", "system", "Deep mode will continue in the next background cycle.");

  return {
    taskId: task.id,
    status: "queued"
  };
}

module.exports = {
  handleUserMessage,
  runBackgroundCycle,
  runDeepMode,
  runFastMode
};
