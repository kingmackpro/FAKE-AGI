const fs = require("fs");
const path = require("path");

const MAX_QUEUE_LENGTH = 50;
const MAX_ARCHIVED_TASKS = 100;
const DEFAULT_LONGTERM_MEMORY = { user: {}, ai: { completedTasks: [] } };

function resolvePath(filePath) {
  return path.resolve(__dirname, "..", filePath);
}

function ensureFile(filePath) {
  const absolutePath = resolvePath(filePath);
  const directory = path.dirname(absolutePath);

  fs.mkdirSync(directory, { recursive: true });

  if (!fs.existsSync(absolutePath)) {
    const fallbackData = filePath.endsWith("dolist.json")
      ? []
      : filePath.endsWith("longterm.json")
        ? DEFAULT_LONGTERM_MEMORY
        : {};

    fs.writeFileSync(absolutePath, JSON.stringify(fallbackData, null, 2));
  }

  return absolutePath;
}

function read(filePath) {
  const absolutePath = ensureFile(filePath);

  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    console.warn(`Failed to parse ${filePath}. Resetting it.`, error.message);

    const fallbackData = filePath.endsWith("dolist.json")
      ? []
      : filePath.endsWith("longterm.json")
        ? DEFAULT_LONGTERM_MEMORY
        : {};

    write(filePath, fallbackData);
    return fallbackData;
  }
}

function write(filePath, data) {
  const absolutePath = ensureFile(filePath);
  fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2), "utf8");
}

function archiveTask(problem) {
  const memory = read("memory/longterm.json");
  const completedTasks = Array.isArray(memory.ai?.completedTasks)
    ? memory.ai.completedTasks
    : [];

  completedTasks.push({
    id: problem.id,
    problem: problem.problem,
    status: problem.status,
    score: problem.score,
    attempts: problem.attempts,
    bestAnswer: problem.current_best,
    completedAt: new Date().toISOString()
  });

  memory.ai = {
    ...(memory.ai || {}),
    completedTasks: completedTasks.slice(-MAX_ARCHIVED_TASKS)
  };

  write("memory/longterm.json", memory);
}

function removeProblemFile(taskId) {
  const absolutePath = resolvePath(`problems/${taskId}.json`);

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

function addTask(question) {
  const normalizedQuestion = String(question || "").trim();

  if (!normalizedQuestion) {
    return null;
  }

  const rawList = read("memory/dolist.json");
  const list = Array.isArray(rawList) ? rawList : [];

  const existingTask = list.find((item) => item.problem === normalizedQuestion);
  if (existingTask) {
    return existingTask.id;
  }

  const id = `p_${Date.now()}`;
  const now = new Date().toISOString();

  const problem = {
    id,
    problem: normalizedQuestion,
    score: 0,
    attempts: 0,
    maxAttempts: 3,
    status: "pending",
    current_best: "",
    lastFeedback: "",
    createdAt: now,
    updatedAt: now
  };

  write(`problems/${id}.json`, problem);

  const nextList = list.concat({
    id,
    problem: normalizedQuestion,
    priority: "high",
    createdAt: now
  });

  while (nextList.length > MAX_QUEUE_LENGTH) {
    const removedTask = nextList.shift();
    if (removedTask?.id) {
      removeProblemFile(removedTask.id);
    }
  }

  write("memory/dolist.json", nextList);

  return id;
}

module.exports = { addTask, archiveTask, read, removeProblemFile, write };
