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

function listActiveTasks() {
  return readQueue()
    .map((item) => readTask(item.id))
    .filter((task) => task && task.id);
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

    if (task.id && task.status !== "paused") {
      return task;
    }

    if (!task.id) {
      queue.shift();
      writeQueue(queue);
      continue;
    }

    queue.push(queue.shift());
    writeQueue(queue);
    return null;
  }

  return null;
}

function completeTask(taskId) {
  const queue = readQueue().filter((item) => item.id !== taskId);
  writeQueue(queue);
  removeFile(`problems/${taskId}.json`);
}

function removeTask(taskId) {
  const queue = readQueue().filter((item) => item.id !== taskId);
  writeQueue(queue);
  removeFile(`problems/${taskId}.json`);
}

function updateTaskStatus(taskId, status) {
  const task = readTask(taskId);
  if (!task.id) {
    return null;
  }

  task.status = status;
  return writeTask(task);
}

function getLatestActiveTask() {
  const queue = readQueue();
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const task = readTask(queue[index].id);
    if (task.id) {
      return task;
    }
  }

  return null;
}

module.exports = {
  completeTask,
  enqueueImprovementTask,
  getNextQueuedTask,
  getLatestActiveTask,
  listActiveTasks,
  readQueue,
  readTask,
  removeTask,
  updateTaskStatus,
  writeTask
};
