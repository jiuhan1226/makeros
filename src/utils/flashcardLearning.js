export function cardMastery(card = {}) {
  if (["new", "learning", "known"].includes(card.studyStatus)) return card.studyStatus;
  if (Number(card.correctCount || 0) >= 2 && Number(card.correctStreak || 0) >= 2) return "known";
  if (Number(card.studyCount || 0) > 0) return "learning";
  return "new";
}

export function filterCardsByMastery(cards = [], filter = "all") {
  return filter === "all" ? cards : cards.filter((card) => cardMastery(card) === filter);
}

export function shuffleCards(cards = [], random = Math.random) {
  const next = [...cards];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function seededRandom(seed = "card") {
  let value = [...String(seed)].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 2166136261);
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function applyCardResult(card = {}, result = "again", now = Date.now()) {
  const correct = result === "known" || result === "correct";
  const correctCount = Number(card.correctCount || 0) + (correct ? 1 : 0);
  const wrongCount = Number(card.wrongCount || 0) + (correct ? 0 : 1);
  const correctStreak = correct ? Number(card.correctStreak || 0) + 1 : 0;
  const studyStatus = result === "known" || correctStreak >= 2 ? "known" : "learning";
  return {
    studyStatus,
    studyCount: Number(card.studyCount || 0) + 1,
    correctCount,
    wrongCount,
    correctStreak,
    lastStudiedAt: now,
  };
}

export function buildQuizChoices(card, cards = [], limit = 4, random) {
  const answer = String(card?.back || "").trim();
  const nextRandom = random || seededRandom(card?.id || card?.front || answer);
  const distractors = [...new Set(cards
    .filter((item) => item.id !== card?.id)
    .map((item) => String(item.back || "").trim())
    .filter((value) => value && value !== answer))];
  const selected = shuffleCards(distractors, nextRandom).slice(0, Math.max(1, limit - 1));
  return shuffleCards([answer, ...selected].filter(Boolean), nextRandom);
}
