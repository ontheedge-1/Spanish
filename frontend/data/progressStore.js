export async function getProgress() {
  return JSON.parse(localStorage.getItem("progress") || "{}");
}

export async function updateProgress(itemId, result) {
  const all = await getProgress();
  const p = all[itemId] || { itemId, strength:0.3, seen:0, correct:0 };
  p.seen++;
  if (result === "correct") {
    p.correct++;
    p.strength = Math.min(1, p.strength + 0.1);
  } else {
    p.strength = Math.max(0, p.strength - 0.15);
  }
  all[itemId] = p;
  localStorage.setItem("progress", JSON.stringify(all));
}
