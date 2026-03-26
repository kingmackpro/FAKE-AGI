const { runCritic } = require("./critic");
const { runFinalizer } = require("./finalizer");
const { extractAndStoreFacts, pushUpdate, rememberInteraction } = require("./memory");
const { completeTask, enqueueImprovementTask, getNextQueuedTask, writeTask } = require("./taskManager");
const { runThinker } = require("./thinker");

const TARGET_CONFIDENCE = 90;
const TARGET_SCORE = 90;
const MAX_STAGNANT_ITERATIONS = 2;

async function runAgentPipeline({ userInput, task, mode }) {
  const storedFacts = await extractAndStoreFacts(userInput);
  const thinkerDraft = await runThinker({
    userInput,
    task,
    priorDraft: task?.bestAnswer || "",
    mode
  });

  const critique = await runCritic({
    userInput,
    task,
    draft: thinkerDraft,
    mode
  });

  const finalAnswer = await runFinalizer({
    userInput,
    task,
    draft: critique.improvedAnswer || thinkerDraft,
    critique,
    mode
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

function shouldQueueForImprovement(result) {
  return result.confidence < TARGET_CONFIDENCE || result.score < TARGET_SCORE;
}

async function handleUserMessage(userInput) {
  const liveResult = await runAgentPipeline({
    userInput,
    task: {
      id: null,
      attempts: 0,
      maxIterations: 0,
      bestAnswer: "",
      bestConfidence: 0
    },
    mode: "live"
  });

  rememberInteraction({
    userInput,
    answer: liveResult.answer,
    confidence: liveResult.confidence,
    mode: "live"
  });

  const queuedTaskId = shouldQueueForImprovement(liveResult)
    ? enqueueImprovementTask({
        userInput,
        currentAnswer: liveResult.answer,
        confidence: liveResult.confidence,
        score: liveResult.score
      })
    : null;

  return {
    reply: liveResult.answer,
    confidence: liveResult.confidence,
    score: liveResult.score,
    queuedTaskId,
    storedFacts: liveResult.storedFacts
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

  const result = await runAgentPipeline({
    userInput: task.userInput,
    task,
    mode: "background"
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
  } else {
    task.stagnantIterations = (task.stagnantIterations || 0) + 1;
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
    const hasBetterAnswer =
      finalAnswer !== task.initialAnswer ||
      finalConfidence > (task.initialConfidence || 0) ||
      (task.bestScore || result.score) > (task.initialScore || 0);

    if (hasBetterAnswer) {
      pushUpdate({
        taskId: task.id,
        originalQuestion: task.userInput,
        answer: finalAnswer,
        confidence: finalConfidence
      });
    }

    rememberInteraction({
      userInput: task.userInput,
      answer: finalAnswer,
      confidence: finalConfidence,
      taskId: task.id,
      mode: "background"
    });

    completeTask(task.id);
    return {
      taskId: task.id,
      status: "completed"
    };
  }

  task.status = "queued";
  writeTask(task);
  return {
    taskId: task.id,
    status: "queued"
  };
}

module.exports = {
  handleUserMessage,
  runAgentPipeline,
  runBackgroundCycle
};
