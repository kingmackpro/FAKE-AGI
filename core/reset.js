const fs = require("fs");
const path = require("path");
const { resolveAppPath, writeJson } = require("./store");

function resetProblemsDirectory() {
  const problemsPath = resolveAppPath("problems");
  fs.mkdirSync(problemsPath, { recursive: true });

  for (const entry of fs.readdirSync(problemsPath, { withFileTypes: true })) {
    const entryPath = path.join(problemsPath, entry.name);
    if (entry.isFile()) {
      fs.unlinkSync(entryPath);
    }
  }
}

function resetSystemState() {
  writeJson("memory/longterm.json", {
    facts: {},
    interactions: [],
    updates: []
  }, {});

  writeJson("memory/dolist.json", [], []);
  writeJson("memory/thoughts.json", [], []);
  resetProblemsDirectory();

  return { ok: true };
}

module.exports = { resetSystemState };
