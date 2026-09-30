import { getQuestionTags, questionProgressId } from "./learningEngine.js";
import { deduplicateQuestions } from "./questionDedup.js";

export const CBT_ROUND_SIZE = 15;

export function calculateCbtBlockProgress({
  targetMinutes = 0,
  completedMinutes = 0,
  elapsedSeconds = 0,
  answeredCount = 0,
  forceComplete = false,
} = {}) {
  const target = Math.max(1, Math.round(Number(targetMinutes) || 1));
  const previous = Math.max(0, Math.round(Number(completedMinutes) || 0));
  const actualMinutes = answeredCount > 0 ? Math.max(1, Math.ceil(Math.max(0, Number(elapsedSeconds) || 0) / 60)) : 0;
  const total = forceComplete ? target : Math.min(target, previous + actualMinutes);
  return {
    targetMinutes: target,
    previousMinutes: previous,
    roundMinutes: actualMinutes,
    completedMinutes: total,
    remainingMinutes: Math.max(0, target - total),
    completed: forceComplete || total >= target,
    progressPercent: Math.min(100, Math.round((total / target) * 100)),
  };
}

function overlap(values = [], targets = new Set()) {
  return values.reduce((count, value) => count + (targets.has(String(value || "").trim()) ? 1 : 0), 0);
}

/**
 * 실제 DB 기출만으로 다음 세트를 만든다. 새 문제를 생성하지 않으며,
 * 미풀이 문제를 우선한 뒤 최근 오답과 같은 과목·유형을 앞에 배치한다.
 */
export function selectContinuousPastQuestions({
  questions = [],
  progress = [],
  seenQuestionIds = [],
  recentWrongQuestions = [],
  limit = CBT_ROUND_SIZE,
} = {}) {
  const unique = deduplicateQuestions(questions).questions;
  const progressById = new Map(progress.map((item) => [String(item.questionId || questionProgressId(item)), item]));
  const seen = new Set(seenQuestionIds.map(String));
  const weakSubjects = new Set();
  const weakTags = new Set();

  [...recentWrongQuestions, ...progress.filter((item) => item.isCorrect === false || Number(item.wrongStreak || 0) > 0)]
    .forEach((item) => {
      const subject = String(item.subject || "").trim();
      if (subject) weakSubjects.add(subject);
      getQuestionTags(item).forEach((tag) => weakTags.add(String(tag || "").trim()));
    });

  const scored = unique.map((question, index) => {
    const id = questionProgressId(question);
    const saved = progressById.get(id);
    const tags = getQuestionTags(question);
    const unseen = !seen.has(id);
    let score = unseen ? 100 : -120;
    if (!saved) score += 45;
    if (saved?.isCorrect === false) score += 90;
    score += Math.min(60, Number(saved?.wrongStreak || 0) * 25);
    if (weakSubjects.has(String(question.subject || "").trim())) score += 24;
    score += overlap(tags, weakTags) * 18;
    // 같은 조건이면 최신 회차 하나에 쏠리지 않도록 원래 DB 순서를 유지한다.
    return { question, id, score, index, unseen };
  }).sort((a, b) => b.score - a.score || a.index - b.index);

  let selected = scored.filter((item) => item.unseen).slice(0, limit);
  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((item) => item.id));
    selected = [...selected, ...scored.filter((item) => !selectedIds.has(item.id)).slice(0, limit - selected.length)];
  }

  return {
    questions: selected.map((item) => item.question),
    questionIds: selected.map((item) => item.id),
    unseenCount: selected.filter((item) => item.unseen && !progressById.has(item.id)).length,
    reviewCount: selected.filter((item) => !item.unseen || progressById.has(item.id)).length,
  };
}
