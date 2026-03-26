const fs = require("fs");
const path = require("path");

function resolveAppPath(relativePath) {
  return path.resolve(__dirname, "..", relativePath);
}

function ensureJsonFile(relativePath, fallbackValue) {
  const absolutePath = resolveAppPath(relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  if (!fs.existsSync(absolutePath)) {
    fs.writeFileSync(absolutePath, JSON.stringify(fallbackValue, null, 2), "utf8");
  }

  return absolutePath;
}

function readJson(relativePath, fallbackValue) {
  const absolutePath = ensureJsonFile(relativePath, fallbackValue);

  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    fs.writeFileSync(absolutePath, JSON.stringify(fallbackValue, null, 2), "utf8");
    return fallbackValue;
  }
}

function writeJson(relativePath, value, fallbackValue = {}) {
  const absolutePath = ensureJsonFile(relativePath, fallbackValue);
  fs.writeFileSync(absolutePath, JSON.stringify(value, null, 2), "utf8");
}

function removeFile(relativePath) {
  const absolutePath = resolveAppPath(relativePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

module.exports = {
  ensureJsonFile,
  readJson,
  removeFile,
  resolveAppPath,
  writeJson
};
