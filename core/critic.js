const { chat } = require("./ai");

async function evaluate(answer, prevScore = 0) {
  const res = await chat([
    {
      role: "system",
      content: "You are a strict critic. Reply with a score from 0 to 100 and concise suggestions for improvement."
    },
    {
      role: "user",
      content: answer
    }
  ]);

  const scoreMatch = res.match(/\b(100|[1-9]?\d)\b/);
  const parsedScore = scoreMatch ? Number.parseInt(scoreMatch[0], 10) : prevScore;
  const score = Number.isFinite(parsedScore)
    ? Math.max(0, Math.min(100, parsedScore))
    : prevScore;

  return { score, feedback: res };
}

module.exports = { evaluate };
