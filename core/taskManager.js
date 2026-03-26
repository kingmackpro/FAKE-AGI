const { readJson, removeFile, writeJson } = require("./store");

const QUEUE_PATH = "memory/dolist.json";
const TASK_HISTORY_LIMIT = 8;
const MAX_QUEUE_LENGTH = 50;

function defaultQueue() {
  return [];
}

function createTaskId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readQueue() {
  const queue = readJson(QUEUE_PATH, defaultQueue());
  return Array.isArray(queue) ? queue : [];
}

function writeQueue(queue) {
  writeJson(QUEUE_PATH, queue, defaultQueue());
}

function readTask(taskId) {
  return readJson(`problems/${taskId}.json`, {});
}

function writeTask(task) {
  const nextTask = {
    ...task,
    history: Array.isArray(task.history) ? task.history.slice(-TASK_HISTORY_LIMIT) : [],
    updatedAt: new Date().toISOString()
  };

  writeJson(`problems/${nextTask.id}.json`, nextTask, {});
  return nextTask;
}

function findQueuedTaskByInput(userInput) {
  return readQueue().find((task) => task.userInput === userInput);
}

function enqueueImprovementTask({ userInput, currentAnswer, confidence, score }) {
  const existingTask = findQueuedTaskByInput(userInput);
  if (existingTask) {
    return existingTask.id;
  }

  const id = createTaskId();
  const now = new Date().toISOString();
  const task = writeTask({
    id,
    userInput,
    status: "queued",
    attempts: 0,
    stagnantIterations: 0,
    maxIterations: 4,
    initialAnswer: currentAnswer,
    initialConfidence: confidence,
    initialScore: score,
    bestAnswer: currentAnswer,
    bestConfidence: confidence,
    bestScore: score,
    history: [],
    createdAt: now,
    updatedAt: now
  });

  const queue = readQueue();
  queue.push({
    id,
    userInput,
    createdAt: now
  });

  while (queue.length > MAX_QUEUE_LENGTH) {
    const removed = queue.shift();
    if (removed?.id) {
      removeFile(`problems/${removed.id}.json`);
    }
  }

  writeQueue(queue);
  return task.id;
}

function getNextQueuedTask() {
  const queue = readQueue();

  while (queue.length) {
    const next = queue[0];
    const task = readTask(next.id);

    if (task.id) {
      return task;
    }

    queue.shift();
    writeQueue(queue);
  }

  return null;
}

function completeTask(taskId) {
  const queue = readQueue().filter((item) => item.id !== taskId);
  writeQueue(queue);
  removeFile(`problems/${taskId}.json`);
}

module.exports = {
  completeTask,
  enqueueImprovementTask,
  getNextQueuedTask,
  readQueue,
  readTask,
  writeTask
};
