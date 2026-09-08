import assert from 'node:assert/strict';
import {
  buildDeterministicPlan,
  confirmPendingPlan,
  createDefaultPartnerState,
  createPlanVersion,
  getActivePartnerPlan,
  normalizePartnerState,
  partnerCalendarItems,
  planDiff,
  rollbackPartnerPlan,
} from '../src/utils/aiPartner.js';

const base = createDefaultPartnerState();
base.profile.weeklyAvailableHours = 8;
base.profile.dailyAvailableMinutes = { mon: 90, tue: 90, wed: 90, thu: 90, fri: 60, sat: 180, sun: 120 };
base.goals = [
  { id: 'a1', type: 'academic', title: '전기기기 내신 80점', startDate: '2026-09-15', deadline: '2026-09-25', details: '현재 58점, 목표 80점, 변압기' },
  { id: 'career1', type: 'career', title: '테스트기업 전기직 취업 준비', deadline: '2027-01-10', details: '전기설비' },
  { id: 'p1', type: 'activity', title: 'AI Competition', deadline: '2026-10-12', details: '작품 제출' },
];
base.certificateGoals = [
  { id: 'c1', name: '전기기능사', status: 'preparing', startDate: '2026-09-20', examDate: '2026-10-18', cbtAccuracy: 62, weakSubjects: ['전기기기'] },
  { id: 'c2', name: '산업안전산업기사', status: 'preparing', examDate: '2026-11-08', cbtAccuracy: 48, weakSubjects: ['산업안전관리론'] },
];
base.certificateGoal = base.certificateGoals[0];
base.primaryCertificateGoalId = 'c1';
base.buildProjects = [{ id: 'project-1', title: '저장된 프로젝트' }];

const plan = buildDeterministicPlan(base, { today: '2026-09-08' });
assert.equal(plan.weeks.length, 18, '가장 늦은 입력 목표일까지 필요한 주차를 계산해야 합니다.');
assert.ok(plan.weeks.at(-1).endsAt >= '2027-01-10', '계획 마지막 주가 가장 늦은 목표일을 포함해야 합니다.');
assert.ok(plan.today.items.length >= 1 && plan.today.items.length <= 5, '오늘 계획은 1~5개여야 합니다.');
assert.ok(plan.weeks.every((week) => week.totalMinutes <= plan.constraints.weeklyAvailableMinutes), '주간 계획이 가능 시간을 넘으면 안 됩니다.');
assert.ok(plan.today.totalMinutes <= plan.today.availableMinutes, '오늘 계획이 오늘 가능 시간을 넘으면 안 됩니다.');
assert.ok(plan.roadmap.some((goal) => goal.type === 'academic'));
assert.ok(plan.roadmap.some((goal) => goal.type === 'certificate'));
assert.ok(plan.roadmap.some((goal) => goal.type === 'career'));
assert.equal(plan.roadmap.filter((goal) => goal.type === 'certificate').length, 2, '여러 자격증이 각각 계획에 포함되어야 합니다.');
assert.ok(!plan.roadmap.some((goal) => goal.title === '저장된 프로젝트'), '프로젝트 모듈 데이터는 목표 계획에 자동 포함되면 안 됩니다.');
assert.ok(plan.roadmap.find((goal) => goal.goalId === 'a1').milestones.every((item) => item.weekIndex >= 1), '목표 시작일 전에는 학습 단계를 배치하면 안 됩니다.');

const calendar = normalizePartnerState({
  ...base,
  calendarExtras: [{ id: 'range-1', title: '집중 학습 기간', startDate: '2026-09-10', endDate: '2026-09-12', isSingleDay: false, type: 'custom' }],
});
assert.equal(partnerCalendarItems(calendar).filter((item) => item.sourceId === 'range-1').length, 3, '기간 일정은 시작일부터 종료일까지 표시되어야 합니다.');
assert.equal(partnerCalendarItems(calendar).filter((item) => item.rangeKey === 'a1').length, 11, '목표 기간 전체가 캘린더에 이어져 표시되어야 합니다.');

let state = createPlanVersion(base, plan, { activate: false });
assert.ok(state.pendingPlanVersionId, '첫 계획은 학생 확정 전 draft여야 합니다.');
state = confirmPendingPlan(state);
assert.ok(getActivePartnerPlan(state), '확정 후 active 계획이 있어야 합니다.');

const changedCertificates = state.certificateGoals.map((item) => item.id === 'c1' ? { ...item, cbtAccuracy: 45 } : item);
const changed = normalizePartnerState({ ...state, certificateGoals: changedCertificates, certificateGoal: changedCertificates[0] });
const replanned = buildDeterministicPlan(changed, { today: '2026-09-08' });
const diff = planDiff(getActivePartnerPlan(state), replanned);
assert.ok(diff && Array.isArray(diff.changed));

const previousActive = state.activePlanVersionId;
state = createPlanVersion(state, replanned, { activate: false });
state = confirmPendingPlan(state);
assert.notEqual(state.activePlanVersionId, previousActive, '새 계획 버전이 활성화되어야 합니다.');
state = rollbackPartnerPlan(state, previousActive);
assert.ok(state.activePlanVersionId, '롤백 후에도 active 버전이 있어야 합니다.');

const legacy = normalizePartnerState({
  schemaVersion: 1,
  academics: [{ id: 'legacy-a', subject: '수학', targetScore: 90, examDate: '2026-09-30', weakUnits: ['함수'] }],
  certificateGoal: { id: 'legacy-c', name: '전기산업기사', examDate: '2026-12-01' },
});
assert.equal(legacy.certificateGoals.length, 1, '기존 단일 자격증 데이터가 새 목록으로 이전되어야 합니다.');
assert.equal(legacy.goals.length, 1, '기존 목표 데이터가 간단 목표 목록으로 이전되어야 합니다.');

console.log('[partner-planning-test] OK');
