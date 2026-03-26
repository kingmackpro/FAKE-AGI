const { runBackgroundCycle } = require("./brain");

let userActive = true;
let cycleRunning = false;

function setUserActive(state) {
  userActive = Boolean(state);
}

async function runCycle() {
  if (userActive || cycleRunning) {
    return null;
  }

  cycleRunning = true;

  try {
    return await runBackgroundCycle();
  } catch (error) {
    console.error("Background cycle failed:", error.message);
    return null;
  } finally {
    cycleRunning = false;
  }
}

module.exports = { runCycle, setUserActive };
