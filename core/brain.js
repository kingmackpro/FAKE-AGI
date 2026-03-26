const { classifyProblem } = require("./classifier");
const { runCritic } = require("./critic");
const { runFastResponder } = require("./fastResponder");
const { runFinalizer } = require("./finalizer");
const { extractAndStoreFacts, pushUpdate, rememberInteraction } = require("./memory");
const { completeTask, enqueueImprovementTask, getNextQueuedTask, writeTask } = require("./taskManager");
const { logThought } = require("./thoughts");
const { runThinker } = require("./thinker");

const TARGET_CONFIDENCE = 90;
const TARGET_SCORE = 90;
const MAX_STAGNANT_ITERATIONS = 2;

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

  const result = await runDeepMode({
    userInput: task.userInput,
    task
  });

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
