import assert from 'node:assert/strict';
import {
  buildDeterministicPlan,
  confirmPendingPlan,
  createDefaultPartnerState,
  createPlanVersion,
  getActivePartnerPlan,
  normalizePartnerState,
  planDiff,
  rollbackPartnerPlan,
} from '../src/utils/aiPartner.js';

const base = createDefaultPartnerState();
base.profile.weeklyAvailableHours = 8;
base.profile.dailyAvailableMinutes = { mon: 90, tue: 90, wed: 90, thu: 90, fri: 60, sat: 180, sun: 120 };
base.academics = [{ id: 'a1', subject: '전기기기', currentScore: 58, targetScore: 80, examDate: '2026-09-25', weakUnits: ['변압기'] }];
base.certificateGoal = { id: 'c1', name: '전기기능사', status: 'preparing', examDate: '2026-10-18', cbtAccuracy: 62, weakSubjects: ['전기기기'] };
base.careerGoal = { industry: '건설', company: '테스트기업', role: '전기직', targetDate: '2027-01-10', skills: ['전기설비'] };
base.activities = [{ id: 'p1', type: 'competition', title: 'AI Competition', deadline: '2026-10-12', stage: 'preparing' }];

const plan = buildDeterministicPlan(base, { today: '2026-09-08' });
assert.equal(plan.weeks.length, 12, '12주 계획이어야 합니다.');
assert.ok(plan.today.items.length >= 1 && plan.today.items.length <= 5, '오늘 계획은 1~5개여야 합니다.');
assert.ok(plan.weeks.every((week) => week.totalMinutes <= plan.constraints.weeklyAvailableMinutes), '주간 계획이 가능 시간을 넘으면 안 됩니다.');
assert.ok(plan.today.totalMinutes <= plan.today.availableMinutes, '오늘 계획이 오늘 가능 시간을 넘으면 안 됩니다.');
assert.ok(plan.roadmap.some((goal) => goal.type === 'academic'));
assert.ok(plan.roadmap.some((goal) => goal.type === 'certificate'));
assert.ok(plan.roadmap.some((goal) => goal.type === 'career'));

let state = createPlanVersion(base, plan, { activate: false });
assert.ok(state.pendingPlanVersionId, '첫 계획은 학생 확정 전 draft여야 합니다.');
state = confirmPendingPlan(state);
assert.ok(getActivePartnerPlan(state), '확정 후 active 계획이 있어야 합니다.');

const changed = normalizePartnerState({ ...state, certificateGoal: { ...state.certificateGoal, cbtAccuracy: 45 } });
const replanned = buildDeterministicPlan(changed, { today: '2026-09-08' });
const diff = planDiff(getActivePartnerPlan(state), replanned);
assert.ok(diff && Array.isArray(diff.changed));

const previousActive = state.activePlanVersionId;
state = createPlanVersion(state, replanned, { activate: false });
state = confirmPendingPlan(state);
assert.notEqual(state.activePlanVersionId, previousActive, '새 계획 버전이 활성화되어야 합니다.');
state = rollbackPartnerPlan(state, previousActive);
assert.ok(state.activePlanVersionId, '롤백 후에도 active 버전이 있어야 합니다.');

console.log('[partner-planning-test] OK');
