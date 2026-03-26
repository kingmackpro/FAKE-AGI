const express = require("express");
const { chat } = require("./core/ai");
const { addTask } = require("./core/taskManager");
const { runCycle, setUserActive } = require("./core/scheduler");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const USER_IDLE_MS = 60_000;
const USER_IDLE_CHECK_MS = 5_000;
const BACKGROUND_CYCLE_MS = 15_000;

const app = express();
app.use(express.json({ limit: "16kb" }));
app.use(express.static("public"));

let lastSeen = Date.now();

app.get("/health", (req, res) => {
  res.json({ ok: true, lastSeen });
});

app.post("/chat", async (req, res) => {
  const userMsg = String(req.body?.message || "").trim();

  if (!userMsg) {
    return res.status(400).json({ error: "message is required" });
  }

  lastSeen = Date.now();
  setUserActive(true);

  try {
    const reply = await chat([
      { role: "user", content: userMsg }
    ]);

    let taskId = null;

    if (reply.length < 50) {
      taskId = addTask(userMsg);
    }

    return res.json({ reply, queuedTaskId: taskId });
  } catch (error) {
    console.error("Chat request failed:", error.message);
    return res.status(502).json({ error: "Failed to contact the AI backend" });
  }
});

setInterval(() => {
  if (Date.now() - lastSeen > USER_IDLE_MS) {
    setUserActive(false);
  }
}, USER_IDLE_CHECK_MS);

setInterval(() => {
  runCycle().catch((error) => {
    console.error("Background cycle failed:", error.message);
  });
}, BACKGROUND_CYCLE_MS);

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
