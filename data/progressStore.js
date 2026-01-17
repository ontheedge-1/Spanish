const KEY = "spanishtrainer:progress:v1";

// strength: 0..1 (1 = sehr sicher => niedrige Prio)
export function getProgressMap() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveProgressMap(map) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function ensureProgress(id) {
  const map = getProgressMap();
  if (!map[id]) {
    map[id] = { itemId: id, strength: 0.25, seen: 0, correct: 0 };
    saveProgressMap(map);
  }
  return map[id];
}

// Optional helper (für später Flashcards): richtig/falsch aktualisiert Strength
export function applyResult(id, result /* "correct" | "wrong" */) {
  const map = getProgressMap();
  const p = map[id] || { itemId: id, strength: 0.25, seen: 0, correct: 0 };

  p.seen += 1;
  if (result === "correct") {
    p.correct += 1;
    p.strength = Math.min(1, p.strength + 0.10);
  } else {
    p.strength = Math.max(0, p.strength - 0.18);
  }

  map[id] = p;
  saveProgressMap(map);
  return p;
}
