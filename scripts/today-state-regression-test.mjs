import assert from 'node:assert/strict';
import { createDefaultPartnerState, buildDeterministicPlan, createPlanVersion, getActivePartnerPlan, adjustTodayPlanItem, rolloverPartnerDay } from '../src/utils/aiPartner.js';
import { resolveDailyCbtSession } from '../src/utils/dailyCbtSession.js';
import { selectContinuousPastQuestions, roundQuestionCount } from '../src/utils/continuousCbt.js';
import { mergeLearningProgress } from '../src/utils/learningEngine.js';
import { mergeAttemptEvents } from '../src/utils/learningMaintenance.js';

const initial = (count = 1) => {
  const state = createDefaultPartnerState();
  state.profile.dailyAvailableMinutes = {mon:90,tue:90,wed:90,thu:90,fri:90,sat:90,sun:90};
  state.certificateGoals = Array.from({length:count}, (_,i) => ({id:`c${i}`,name:`종목${i}`,startDate:'2026-09-28',examDate:'2026-10-10'}));
  state.certificateGoal = state.certificateGoals[0];
  return createPlanVersion(state, buildDeterministicPlan(state,{today:'2026-09-28'}), {activate:true});
};
let state = initial();
let item = getActivePartnerPlan(state).today.items[0];
assert.equal(item.durationMinutes,75);
state = adjustTodayPlanItem(state,item.id,'reduce');
state = createPlanVersion(state,buildDeterministicPlan(state,{today:'2026-09-28'}),{activate:true});
assert.equal(getActivePartnerPlan(state).today.items[0].durationMinutes,60,'재계획은 사용자가 줄인 분량을 복구하면 안 된다');
item = getActivePartnerPlan(state).today.items[0];
state = adjustTodayPlanItem(state,item.id,'skip');
state = createPlanVersion(state,buildDeterministicPlan(state,{today:'2026-09-28'}),{activate:true});
assert.equal(getActivePartnerPlan(state).today.totalMinutes,0,'건너뛴 일은 오늘 시간 합계에서 제외');
state = rolloverPartnerDay(state,{today:'2026-09-29'});
assert.equal(getActivePartnerPlan(state).today.items[0].durationMinutes,75,'전날의 줄이기·건너뛰기를 다음 날에 전파하지 않는다');

state = initial();
item = getActivePartnerPlan(state).today.items[0];
const exam = {id:'set2',partnerGoalId:'c0',partnerItemId:item.id,studyBlockDate:'2026-09-28',studyBlockTargetMinutes:75};
const first = {sessionId:'first',goalId:'c0',date:'2026-09-28',durationSeconds:600,answered:10,answeredIds:['q1'],submitted:true};
const current = {...first,sessionId:'current',durationSeconds:300,answered:5,submitted:false};
state.cbtStudySessions = [first,current];
state = adjustTodayPlanItem(state,item.id,'reduce');
let resolved = resolveDailyCbtSession(exam,getActivePartnerPlan(state),state.cbtStudySessions,current);
assert.equal(resolved.metadata.studyBlockTargetMinutes,60);
assert.equal(resolved.metadata.studyBlockCompletedSeconds,600,'세션의 이전 시간에는 현재 세션을 중복 합산하지 않는다');
assert.equal(resolved.progress.completedSeconds,900);
assert.equal(resolved.progress.remainingMinutes,45);
for(let n=0;n<3;n++) state=adjustTodayPlanItem(state,item.id,'reduce');
assert.equal(getActivePartnerPlan(state).today.items[0].status,'completed','목표 축소 후 달성 여부 즉시 다시 계산');
state=adjustTodayPlanItem(state,item.id,'skip');
assert.equal(resolveDailyCbtSession(exam,getActivePartnerPlan(state),state.cbtStudySessions,current).detached,true);
assert.equal(resolveDailyCbtSession(exam,{today:{date:'2026-09-29',items:[item]}},[],current).detached,true);
assert.equal(resolveDailyCbtSession(exam,{today:{date:'2026-09-28',items:[]}},[],current).detached,true);

state=initial(6);
const reached = new Set();
for(const date of ['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02']) {
  state=rolloverPartnerDay(state,{today:date});
  const today=getActivePartnerPlan(state).today;
  assert.ok(today.items.length<=5 && today.totalMinutes<=90);
  today.items.forEach(i=>reached.add(i.goalId));
}
assert.equal(reached.size,6,'자정마다 앞의 다섯 목표로 초기화되어 여섯째 목표가 영구 누락되면 안 된다');
state=initial(6);
const firstDayIds=getActivePartnerPlan(state).today.items.map(i=>i.goalId);
for(let n=0;n<35;n++) state=createPlanVersion(state,buildDeterministicPlan(state,{today:'2026-09-28'}),{activate:false});
state=rolloverPartnerDay(state,{today:'2026-09-29'});
assert.ok(getActivePartnerPlan(state).today.items.some(i=>!firstDayIds.includes(i.goalId)),'초안을 여러 번 계산해도 목표 순환 기록을 보존');

const q={id:'q',question:'옴의 법칙은?',choices:['V=IR','V=I/R'],answerIndex:0,subject:'전기'};
for(const answerIndex of [null,undefined,'',false,-1,2,NaN]) assert.equal(selectContinuousPastQuestions({questions:[{...q,answerIndex}]}).questions.length,0);
assert.equal(selectContinuousPastQuestions({questions:[{...q,choices:['','']}]}).questions.length,0);
assert.equal(selectContinuousPastQuestions({questions:[{...q,choices:['',''],choiceImageUrls:['a.png','b.png']}]}).questions.length,1);
const other=Array.from({length:20},(_,i)=>({...q,id:`new${i}`,question:`새 문제 ${i}`}));
const old={...q,questionId:'q',isCorrect:false,lastSolvedAt:100};
const corrected={...q,id:'another-year',questionId:'another-year',isCorrect:true,lastSolvedAt:200,nextReviewAt:999999};
const selected=selectContinuousPastQuestions({questions:[q,...other],progress:[old,corrected],recentWrongQuestions:[q],now:300,limit:5});
assert.ok(!selected.questionIds.includes('q'),'다른 회차의 동일 문제에서 맞힌 최신 기록을 우선');
const mixed=selectContinuousPastQuestions({questions:[...other.map(q=>({...q,subject:'회로'})),...other.map(q=>({...q,id:`other-${q.id}`,question:`다른 과목 ${q.question}`,subject:'기기'}))],limit:6});
assert.equal(mixed.questions.filter(q=>q.subject==='회로').length,3,'첫 기출 세트가 DB 첫 과목만 채택하지 않는다');
assert.equal(roundQuestionCount(3,[{answered:'15',durationSeconds:'1800'},{answered:'15',durationSeconds:'1800'}]),1);
assert.equal(roundQuestionCount(10,[{sessionId:'same',answered:10,durationSeconds:200},{sessionId:'same',answered:10,durationSeconds:200},{sessionId:'slow',answered:10,durationSeconds:1800}]),6,'속도 추정의 세션 중복 제거');

const payload={question:q,attemptId:'a',isCorrect:false,selectedAnswerIndex:1,now:1000};
let progress=mergeLearningProgress([],payload);
progress=mergeLearningProgress(progress,{...payload,isCorrect:true,selectedAnswerIndex:0,now:2000});
assert.deepEqual([progress[0].attemptCount,progress[0].correctCount,progress[0].wrongCount,progress[0].wrongStreak],[1,1,0,0]);
assert.equal(progress[0].lastSolvedAt,1000,'동일 풀이 재저장으로 복습 시점이 밀리지 않는다');
progress=mergeLearningProgress(progress,{...payload,attemptId:'b',isCorrect:true,selectedAnswerIndex:0,now:3000});
const snapshot=progress;
progress=mergeLearningProgress(progress,{...payload,now:4000});
assert.strictEqual(progress,snapshot,'오래된 풀이 재전송이 최신 정오답을 덮어쓰지 않는다');
let events=mergeAttemptEvents([],payload);
events=mergeAttemptEvents(events,{...payload,now:9000});
assert.equal(events[0].answeredAt,1000);
console.log('[today-state-regression] planning, session reconciliation, selection, record replay passed');
