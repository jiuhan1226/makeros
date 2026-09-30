import assert from "node:assert/strict";
import { pageFromLocation, pageToHash } from "../src/utils/appRouting.js";
import { readSavedExamSession } from "../src/hooks/useExamSession.js";
import {
  adjustTodayPlanItem,
  buildDeterministicPlan,
  collectGoals,
  createDefaultPartnerState,
  createPlanVersion,
  getActivePartnerPlan,
} from "../src/utils/aiPartner.js";

assert.equal(pageToHash("partnerToday"), "#/today");
assert.equal(pageFromLocation({ hash: "#/all-questions" }), "all");
assert.equal(pageFromLocation({ hash: "#/topic" }), "all", "이전 주제별 주소도 전체 문제로 연결되어야 합니다.");
assert.equal(pageFromLocation({ hash: "#/unknown" }), "partnerToday");

const storage = {
  getItem: () => JSON.stringify({
    exam: { id: "all-1", studyScope: "all" },
    questions: [{ id: "q1" }, { id: "q2" }],
    mode: "연습모드",
    answers: { 0: 1 },
    current: 1,
    remaining: 60,
    startedAt: 123,
    savedAt: Date.now(),
  }),
};
const restored = readSavedExamSession(storage);
assert.equal(restored.questions.length, 2);
assert.equal(restored.answers[0], 1);
assert.equal(restored.current, 1);

const state = createDefaultPartnerState();
state.goals = [{ id: "academic-1", type: "academic", title: "전기기기 내신", deadline: "2026-10-20" }];
state.learningSignals = [{ id: "signal-1", type: "pdf_quiz", goalId: 'academic-1', score: 45, weakSubjects: ["변압기"], createdAt: Date.now() }];
const academic = collectGoals(state).find((goal) => goal.goalId === "academic-1");
assert.equal(academic.meta.recentScore, 45, "PDF 이해도 점수가 내신 목표 입력으로 전달되어야 합니다.");
assert.deepEqual(academic.meta.weakSubjects, ["변압기"]);
const unrelated=collectGoals({...state,goals:[...state.goals,{id:'math',type:'academic',title:'수학 내신',deadline:'2026-10-20'}]}).find(goal=>goal.goalId==='math');
assert.equal(unrelated.meta.recentScore,undefined,'전기기기 PDF 점수를 수학 목표에 섞지 않는다');

const plan = buildDeterministicPlan(state, { today: "2026-09-14" });
let plannedState = createPlanVersion(state, plan, { activate: true });
const before = getActivePartnerPlan(plannedState);
const target = before.today.items[0];
plannedState = adjustTodayPlanItem(plannedState, target.id, "defer");
const after = getActivePartnerPlan(plannedState);
assert.ok(!after.today.items.some((item) => item.id === target.id && !['deferred','skipped'].includes(item.status)), "내일로 이동한 일은 오늘 실행 대상에서 빠져야 합니다.");
assert.ok(after.today.adjustments.some((item) => item.action === "defer"), "학생의 조정 기록이 남아야 합니다.");
assert.ok(!after.today.items.some((item) => item.goalId === target.goalId && item.status === 'todo'), "미룬 목표를 다른 회차로 다시 채우면 안 됩니다.");

console.log("[experience-flow-test] OK");
