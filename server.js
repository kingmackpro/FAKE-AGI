require("dotenv").config();

const express = require("express");
const { handleUserMessage } = require("./core/brain");
const { getUpdatesSince } = require("./core/memory");
const { resetSystemState } = require("./core/reset");
const { runCycle, setUserActive } = require("./core/scheduler");
const { getThoughts } = require("./core/thoughts");
const { warmupModel } = require("./core/ai");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const USER_IDLE_MS = 60_000;
const USER_IDLE_CHECK_MS = 5_000;
const BACKGROUND_CYCLE_MS = 15_000;

let SYSTEM_STATE = "booting";
let modelReady = false;
let lastSeen = Date.now();

async function warmupAndMarkReady() {
  try {
    SYSTEM_STATE = "booting";
    await warmupModel();
    modelReady = true;
    SYSTEM_STATE = "ready";
    console.log("Model warmup complete");
  } catch (error) {
    SYSTEM_STATE = "booting";
    modelReady = false;
    console.error("Model warmup failed:", error.message);
    setTimeout(() => {
      warmupAndMarkReady().catch(() => {});
    }, 5000);
  }
}

const app = express();
app.use(express.json({ limit: "24kb" }));
app.use(express.static("public"));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    lastSeen,
    systemState: SYSTEM_STATE,
    modelReady
  });
});

app.get("/updates", (req, res) => {
  const since = req.query.since || 0;
  res.json({ updates: getUpdatesSince(since) });
});

app.get("/thoughts", (req, res) => {
  res.json({
    thoughts: getThoughts({
      since: req.query.since || 0,
      taskId: req.query.taskId || null
    })
  });
});

app.post("/chat", async (req, res) => {
  if (!modelReady) {
    return res.status(503).json({ error: "Model is still booting" });
  }

  const userMsg = String(req.body?.message || "").trim();
  if (!userMsg) {
    return res.status(400).json({ error: "message is required" });
  }

  lastSeen = Date.now();
  setUserActive(true);
  SYSTEM_STATE = "busy";

  try {
    const result = await handleUserMessage(userMsg);
    SYSTEM_STATE = "ready";
    return res.json({
      ...result,
      systemState: SYSTEM_STATE
    });
  } catch (error) {
    SYSTEM_STATE = "ready";
    console.error("Chat request failed:", error.message);
    return res.status(502).json({ error: "Failed to process the message with Ollama" });
  }
});

app.post("/reset", (req, res) => {
  const result = resetSystemState();
  lastSeen = Date.now();
  setUserActive(true);
  res.json(result);
});

setInterval(() => {
  if (Date.now() - lastSeen > USER_IDLE_MS) {
    setUserActive(false);
  }
}, USER_IDLE_CHECK_MS);

setInterval(() => {
  if (modelReady) {
    runCycle().catch((error) => {
      console.error("Scheduled background cycle failed:", error.message);
    });
  }
}, BACKGROUND_CYCLE_MS);

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  warmupAndMarkReady().catch(() => {});
});
