import { useMemo, useState } from "react";
import {
  buildExamReadiness,
  buildTodayStudyPlan,
  dDayAnalysis,
  estimatePassProjection,
} from "../utils/learningEngine";

export default function PlannerPage({
  certificate,
  wrongNotes = [],
  history = [],
  practiceHistory = [],
  learningProgress = [],
  exams = [],
  plan = {},
  onSavePlan,
  onStartRecommended,
  onStartDueReview,
  onStartRepeatedWrong,
  pdfLibrary = [],
}) {
  const [examDate, setExamDate] = useState(plan?.examDate || "");
  const [dailyGoal, setDailyGoal] = useState(plan?.dailyGoal || 30);
  const [pdfGoal, setPdfGoal] = useState(plan?.pdfGoal || 10);
  const [days, setDays] = useState(plan?.studyDays || [1, 2, 3, 4, 5, 6]);
  const currentPlan = useMemo(
    () => ({ examDate, dailyGoal, pdfGoal, studyDays: days }),
    [dailyGoal, days, examDate, pdfGoal],
  );
  const projection = useMemo(
    () => estimatePassProjection(history, Number(certificate?.passScore || 60)),
    [certificate?.passScore, history],
  );
  const readiness = useMemo(
    () => buildExamReadiness({
      progress: learningProgress,
      history,
      exams,
      plan: currentPlan,
      passScore: Number(certificate?.passScore || 60),
    }),
    [certificate?.passScore, currentPlan, exams, history, learningProgress],
  );
  const today = useMemo(
    () => buildTodayStudyPlan({ progress: learningProgress, wrongNotes, practiceHistory, plan: currentPlan, pdfLibrary, readiness }),
    [currentPlan, learningProgress, pdfLibrary, practiceHistory, readiness, wrongNotes],
  );
  const dday = useMemo(() => dDayAnalysis(currentPlan, readiness), [currentPlan, readiness]);
  const activeToday = days.includes(new Date().getDay());
  const weakTask = today.tasks.find((task) => task.id === "weak");

  function save() {
    onSavePlan?.(currentPlan);
  }

  return (
    <main className="page-shell">
      <section className="page-title">
        <div>
          <span className="eyebrow">AI STUDY PLANNER</span>
          <h1>D-Day 학습 플래너</h1>
          <p>시험일까지 필요한 학습량을 나누고 오늘의 목표를 확인하세요.</p>
        </div>
      </section>

      <section className="planner-grid">
        <article className="panel">
          <h2>시험 일정과 목표</h2>
          <label className="field-label">시험일<input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label>
          <label className="field-label">하루 전체 목표 문제 수<input type="number" min="10" max="250" step="5" value={dailyGoal} onChange={(event) => setDailyGoal(Number(event.target.value))} /></label>
          <label className="field-label">PDF 학습 목표<input type="number" min="0" max="100" step="5" value={pdfGoal} onChange={(event) => setPdfGoal(Number(event.target.value))} /></label>
          <div className="weekday-picker">
            {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
              <button key={day} className={days.includes(index) ? "active" : ""} onClick={() => setDays((value) => value.includes(index) ? value.filter((item) => item !== index) : [...value, index])}>{day}</button>
            ))}
          </div>
          <button className="primary" onClick={save}>계획 저장</button>
        </article>

        <article className="panel planner-dday planner-dday-v2">
          <span>시험일까지</span>
          <strong>{dday.dday === null ? "날짜 미설정" : dday.dday >= 0 ? `D-${dday.dday}` : `D+${Math.abs(dday.dday)}`}</strong>
          <p>{certificate?.name || "통합 학습"}</p>
          <dl>
            <div><dt>시험 준비도</dt><dd>{readiness.readinessScore}% · {readiness.stage}</dd></div>
            <div><dt>기출 학습 회차</dt><dd>{readiness.coveredSessions}/{readiness.recommendedExamSessions}회</dd></div>
            <div><dt>권장 일일 문제</dt><dd>{dday.requiredDailyQuestions === null ? "-" : `${dday.requiredDailyQuestions}문제`}</dd></div>
            <div><dt>예상 점수</dt><dd>{projection.expectedScore === null ? "실전 기록 필요" : `${projection.expectedScore}점`}</dd></div>
          </dl>
          <small>{activeToday ? "오늘은 학습일입니다." : "오늘은 계획된 휴식일입니다."}</small>
        </article>
      </section>

      <section className="panel">
        <span className="eyebrow">TODAY'S PLAN</span>
        <h2>오늘의 추천 학습</h2>
        <div className="today-plan today-plan-actions">
          {today.tasks.map((task, index) => (
            <div key={task.id} className={!task.enabled ? "disabled" : ""}>
              <b>{index + 1}</b>
              <span><strong>{task.title}</strong><small>{task.count}개 · {task.detail}</small></span>
              {task.id === "srs" && <button className="secondary" disabled={!task.enabled || !activeToday} onClick={() => onStartDueReview?.(today.due)}>시작</button>}
              {task.id === "repeated" && <button className="secondary" disabled={!task.enabled || !activeToday} onClick={() => onStartRepeatedWrong?.(today.repeated)}>시작</button>}
              {task.id === "weak" && <button className="secondary" disabled={!activeToday} onClick={() => onStartRecommended?.(weakTask?.title || "전체 과목", task.count)}>시작</button>}
            </div>
          ))}
        </div>
        {!activeToday && <p className="muted">오늘은 휴식일로 설정되어 있습니다. 요일 설정을 변경하면 학습을 시작할 수 있습니다.</p>}
      </section>
    </main>
  );
}
