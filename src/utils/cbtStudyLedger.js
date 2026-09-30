import { questionProgressId } from './learningEngine.js';

// Replace a cumulative session snapshot, never add it twice (exit/retry/reload).
export function upsertStudySession(records = [], snapshot) {
  const previous = records.find((s) => s.sessionId === snapshot.sessionId);
  if (previous && (previous.answered > snapshot.answered || previous.durationSeconds > snapshot.durationSeconds)) return records;
  if (previous && previous.answered === snapshot.answered && previous.submitted === snapshot.submitted
    && Math.floor(previous.durationSeconds / 60) === Math.floor(snapshot.durationSeconds / 60)
    && !snapshot.endedEarly && !snapshot.final) return records;
  return [{ ...previous, ...snapshot, endedEarly: Boolean(previous?.endedEarly || snapshot.endedEarly) },
    ...records.filter((s) => s.sessionId !== snapshot.sessionId)].slice(0, 1000);
}

export function studySessionSnapshot(session, { date, endedEarly = false } = {}) {
  const answered = session.questions.filter((q, i) => session.answers[i] !== undefined);
  return {
    sessionId: `${session.startedAt}:${session.exam.id}`,
    goalId: session.exam.partnerGoalId || '',
    date: session.exam.studyBlockDate || date,
    certificateId: session.exam.certificateId,
    durationSeconds: answered.length ? Math.max(0, session.elapsedSeconds) : 0,
    answered: answered.length,
    answeredIds: answered.map(questionProgressId),
    submitted: Boolean(session.submitted),
    endedEarly: Boolean(endedEarly && answered.length),
    updatedAt: Date.now(),
  };
}

export function dailyCbtProgress(records = [], goalId, date, targetMinutes) {
  const rows = records.filter((s) => s.goalId === goalId && s.date === date);
  const completedSeconds = rows.reduce((sum, s) => sum + Number(s.durationSeconds || 0), 0);
  const completedQuestions = rows.reduce((sum, s) => sum + Number(s.answered || 0), 0);
  const endedEarly = rows.some((s) => s.endedEarly);
  return {
    completedSeconds, completedMinutes: Math.floor(completedSeconds / 60), completedQuestions,
    targetMinutes, remainingMinutes: Math.max(0, Math.ceil((targetMinutes * 60 - completedSeconds) / 60)),
    roundCount: rows.filter((s) => s.submitted).length,
    seenQuestionIds: [...new Set(rows.flatMap((s) => s.answeredIds || []))],
    endedEarly,
    status: endedEarly || completedSeconds >= targetMinutes * 60 ? 'completed' : completedQuestions ? 'in_progress' : 'todo',
  };
}

export function applyDailyCbtProgress(plan, records = []) {
  if (!plan?.today) return plan;
  return { ...plan, today: { ...plan.today, items: (plan.today.items || []).map((item) => {
    if (item.action !== 'cbt' || !records.some((s) => s.goalId === item.goalId && s.date === plan.today.date)) return item;
    const result = dailyCbtProgress(records, item.goalId, plan.today.date, item.durationMinutes);
    return { ...item, status: ['skipped','deferred'].includes(item.status) ? item.status : result.status, result: { ...item.result, ...result } };
  }) } };
}
