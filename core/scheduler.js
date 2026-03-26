const fs = require("fs");
const path = require("path");
const { chat } = require("./ai");
const { evaluate } = require("./critic");
const { archiveTask, read, removeProblemFile, write } = require("./taskManager");

let userActive = true;
let cycleRunning = false;

function setUserActive(state) {
  userActive = Boolean(state);
}

async function runCycle() {
  if (userActive || cycleRunning) {
    return;
  }

  cycleRunning = true;

  try {
    const list = read("memory/dolist.json");
    if (!Array.isArray(list) || !list.length) {
      return;
    }

    const task = list[0];
    const problemFile = path.resolve(__dirname, "..", "problems", `${task.id}.json`);

    if (!fs.existsSync(problemFile)) {
      list.shift();
      write("memory/dolist.json", list);
      return;
    }

    const problem = read(`problems/${task.id}.json`);
    problem.attempts = (problem.attempts || 0) + 1;
    problem.maxAttempts = problem.maxAttempts || 3;
    problem.status = "running";
    problem.updatedAt = new Date().toISOString();

    const answer = await chat([
      { role: "user", content: problem.problem }
    ]);

    const result = await evaluate(answer, problem.score);
    problem.lastFeedback = result.feedback;

    if (result.score >= problem.score) {
      problem.current_best = answer;
      problem.score = result.score;
    }

    const reachedLimit = problem.attempts >= problem.maxAttempts;
    const goodEnough = problem.score >= 85;

    if (reachedLimit || goodEnough) {
      problem.status = goodEnough ? "done" : "stopped";
      write(`problems/${task.id}.json`, problem);
      archiveTask(problem);
      removeProblemFile(task.id);

      list.shift();
      write("memory/dolist.json", list);

      console.log(`${goodEnough ? "[done]" : "[stopped]"} Task ${task.id} after ${problem.attempts} attempt(s)`);
      return;
    }

    problem.status = "pending";
    write(`problems/${task.id}.json`, problem);
  } catch (error) {
    console.error("Scheduler cycle failed:", error.message);
  } finally {
    cycleRunning = false;
  }
}

module.exports = { runCycle, setUserActive };
