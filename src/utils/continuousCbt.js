import { getQuestionTags, questionProgressId } from "./learningEngine.js";
import { deduplicateQuestions, questionContentKey } from "./questionDedup.js";

export const CBT_ROUND_SIZE = 15;

export function calculateCbtBlockProgress({
  targetMinutes = 0,
  completedMinutes = 0,
  completedSeconds,
  elapsedSeconds = 0,
  answeredCount = 0,
  forceComplete = false,
} = {}) {
  const target = Math.max(1, Math.round(Number(targetMinutes) || 1));
  const previousSeconds = Math.max(0, Number(completedSeconds ?? Number(completedMinutes) * 60) || 0);
  const roundSeconds = answeredCount > 0 ? Math.max(0, Number(elapsedSeconds) || 0) : 0;
  const totalSeconds = previousSeconds + roundSeconds;
  const previous = Math.floor(previousSeconds / 60);
  const actualMinutes = Math.floor(roundSeconds / 60);
  const total = Math.floor(totalSeconds / 60);
  return {
    targetMinutes: target,
    previousMinutes: previous,
    roundMinutes: actualMinutes,
    completedMinutes: total,
    completedSeconds: totalSeconds,
    remainingMinutes: Math.max(0, Math.ceil((target * 60 - totalSeconds) / 60)),
    completed: forceComplete || totalSeconds >= target * 60,
    endedEarly: forceComplete && totalSeconds < target * 60,
    progressPercent: Math.min(100, Math.floor(totalSeconds / (target * 60) * 100)),
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
  now = Date.now(),
} = {}) {
  const valid = questions.filter((q) => Array.isArray(q.choices) && q.choices.length >= 2
    && (typeof q.answerIndex === 'number' || typeof q.answerIndex === 'string' && q.answerIndex.trim() !== '')
    && Number.isInteger(Number(q.answerIndex)) && Number(q.answerIndex) >= 0 && Number(q.answerIndex) < q.choices.length
    && q.choices.every((choice, i) => String(choice ?? '').trim() || q.choiceImageUrls?.[i])
    && (String(q.question || '').trim() || q.imageUrl || q.questionImageUrls?.length));
  const unique = deduplicateQuestions(valid).questions;
  const latestOf = (a, b) => !a || Number(b?.lastSolvedAt || 0) > Number(a.lastSolvedAt || 0) ? b : a;
  const progressById = new Map();
  const byContent = new Map();
  progress.forEach((row) => {
    const id = String(row.questionId || questionProgressId(row));
    progressById.set(id, latestOf(progressById.get(id), row));
    const key = questionContentKey({ ...row, answerIndex: row.answerIndex ?? row.correctAnswerIndex });
    if (!byContent.has(key) || Number(row.lastSolvedAt || 0) > Number(byContent.get(key).lastSolvedAt || 0)) byContent.set(key, row);
  });
  const latestProgress = (q) => latestOf(progressById.get(questionProgressId(q)), byContent.get(questionContentKey(q)));
  const seen = new Set(seenQuestionIds.map(String));
  const weakSubjects = new Set();
  const weakTags = new Set();

  const currentWrong = recentWrongQuestions.filter((q) => {
    const latest = latestProgress(q);
    return !latest || latest.isCorrect === false;
  });
  const wrongIds = new Set(currentWrong.map(questionProgressId));
  [...currentWrong, ...unique.map(latestProgress).filter((item) => item?.isCorrect === false)]
    .forEach((item) => {
      const subject = String(item.subject || "").trim();
      if (subject) weakSubjects.add(subject);
      getQuestionTags(item).forEach((tag) => weakTags.add(String(tag || "").trim()));
    });

  const scored = unique.map((question, index) => {
    const id = questionProgressId(question);
    const saved = latestProgress(question);
    const tags = getQuestionTags(question);
    const unseen = !seen.has(id);
    let score = unseen ? 100 : -120;
    if (!saved) score += 45;
    if (saved?.isCorrect === false) score += 90;
    score += Math.min(60, Number(saved?.wrongStreak || 0) * 25);
    if (weakSubjects.has(String(question.subject || "").trim())) score += 24;
    score += overlap(tags, weakTags) * 18;
    // 같은 조건이면 최신 회차 하나에 쏠리지 않도록 원래 DB 순서를 유지한다.
    const wrong = saved?.isCorrect === false || (!saved && wrongIds.has(id));
    const due = Boolean(saved && Number(saved.nextReviewAt || Infinity) <= now);
    const similar = overlap(tags.filter((tag) => tag && tag !== question.subject && !/공통|기타|미분류/.test(tag)), weakTags) > 0;
    return { question, id, score, index, unseen, saved, wrong, due, similar };
  }).sort((a, b) => b.score - a.score || a.index - b.index);

  const count = Math.min(unique.length, Math.max(1, Math.floor(Number(limit) || CBT_ROUND_SIZE)));
  const selected = [];
  const selectedIds = new Set();
  const take = (pool, quota, reason) => {
    for (const item of pool) {
      if (quota <= 0 || selected.length >= count) break;
      if (selectedIds.has(item.id)) continue;
      selected.push({ ...item, reason }); selectedIds.add(item.id); quota -= 1;
    }
  };
  // 복습 자리를 먼저 확보한다. 이미 본 오답을 미풀이 필터로 제거하지 않는다.
  take(scored.filter((x) => x.wrong || x.due), Math.max(1, Math.floor(count * .4)), 'review');
  take(scored.filter((x) => x.similar && !x.saved && x.unseen), Math.floor(count * .2), 'similar');
  const subjectPools = new Map();
  for (const candidate of scored.filter((x) => !x.saved && x.unseen)) {
    const subject = candidate.question.subject || '공통';
    if (!subjectPools.has(subject)) subjectPools.set(subject, []);
    subjectPools.get(subject).push(candidate);
  }
  const diversified = [];
  while (diversified.length < count + selected.length && [...subjectPools.values()].some((pool) => pool.length)) {
    for (const pool of subjectPools.values()) if (pool.length) diversified.push(pool.shift());
  }
  take(diversified, count, 'new');
  take(scored.filter((x) => x.wrong || x.due), count, 'review');
  take([...scored].sort((a,b) => Number(a.saved?.lastSolvedAt || 0) - Number(b.saved?.lastSolvedAt || 0)), count, 'repeat');

  return {
    questions: selected.map((item) => item.question),
    questionIds: selected.map((item) => item.id),
    unseenCount: selected.filter((item) => !item.saved && item.unseen).length,
    reviewCount: selected.filter((item) => item.reason === 'review').length,
    similarCount: selected.filter((item) => item.reason === 'similar').length,
    repeatCount: selected.filter((item) => item.reason === 'repeat').length,
    selectionReasons: selected.map((item) => ({ id: item.id, reason: item.reason })),
  };
}

export function roundQuestionCount(remainingMinutes, history = []) {
  const sessions = new Map();
  history.forEach((s, index) => {
    const key = s.sessionId || `unkeyed-${index}`;
    const old = sessions.get(key);
    if (!old || Number(s.durationSeconds) > Number(old.durationSeconds)) sessions.set(key, s);
  });
  const usable = [...sessions.values()].filter((s) => Number.isFinite(Number(s.answered)) && Number.isFinite(Number(s.durationSeconds))
    && Number(s.answered) > 0 && Number(s.durationSeconds) > 0);
  const answers = usable.reduce((sum,s) => sum + Number(s.answered), 0);
  const seconds = usable.reduce((sum,s) => sum + Number(s.durationSeconds), 0);
  const perQuestion = Math.min(180, Math.max(20, answers >= 10 ? seconds / answers : 60));
  return Math.max(1, Math.min(CBT_ROUND_SIZE, Math.floor(Math.max(0, remainingMinutes) * 60 / perQuestion)));
}
