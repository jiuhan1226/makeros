import { dailyCbtProgress, upsertStudySession } from './cbtStudyLedger.js';

// Resolve against the current dated plan, never the copy captured when a set started.
export function resolveDailyCbtSession(exam, plan, records = [], snapshot) {
  if (!exam?.studyBlockTargetMinutes) return null;
  const item = plan?.today?.items?.find((row) => row.action === 'cbt' && row.goalId === exam.partnerGoalId);
  if (!plan || plan.today?.date !== exam.studyBlockDate || !item || plan.today.isDayOff
    || ['skipped', 'deferred'].includes(item.status)) {
    return { detached: true, message: '오늘 계획이 변경되어 이 세트는 일반 연습으로 보관합니다. 풀이 기록은 유지됩니다.' };
  }
  const ledger = snapshot ? upsertStudySession(records, { ...snapshot, final: true }) : records;
  const progress = dailyCbtProgress(ledger, item.goalId, plan.today.date, item.durationMinutes);
  const prior = dailyCbtProgress(ledger.filter((row) => row.sessionId !== snapshot?.sessionId), item.goalId, plan.today.date, item.durationMinutes);
  return {
    detached: false, item, progress, ledger,
    metadata: {
      partnerItemId: item.id,
      studyBlockTargetMinutes: item.durationMinutes,
      studyBlockCompletedSeconds: prior.completedSeconds,
      studyBlockCompletedMinutes: prior.completedMinutes,
    },
  };
}
