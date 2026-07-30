import { useMemo, useState } from "react";
import StatCard from "../components/StatCard";
import { isTargetedPracticeRecord, masteryStageForProgress } from "../utils/learningEngine";

function dayKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function aggregate(records = []) {
  const total = records.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const correct = records.reduce((sum, item) => sum + Number(item.correct || 0), 0);
  return { total, correct, accuracy: total ? Math.round((correct / total) * 100) : 0 };
}

const LEARNING_TYPE_LABELS = {
  exam: "기출 시험",
  mock: "모의고사",
  examPractice: "기출 연습",
  subjectPractice: "과목별 학습",
  topicPractice: "주제별 학습",
  srsReview: "자동 복습",
  repeatedWrong: "반복 오답",
  dailyRecommended: "오늘의 추천",
  pdfPractice: "PDF 학습",
};

export default function StudyStatsPage({
  examHistory = [],
  practiceHistory = [],
  studyEvents = [],
  attemptEvents = [],
  learningProgress = [],
  certificates = [],
  selectedCertificateId = "",
  onRecalculate,
  onReset,
}) {
  const [maintenanceScope, setMaintenanceScope] = useState(selectedCertificateId || "");
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const examStats = useMemo(() => aggregate(examHistory), [examHistory]);
  const practiceStats = useMemo(() => aggregate(practiceHistory), [practiceHistory]);
  const targeted = useMemo(() => practiceHistory.filter(isTargetedPracticeRecord), [practiceHistory]);
  const subjectRows = useMemo(() => {
    const subjectMap = new Map();
    for (const session of targeted) {
      for (const item of session.subjects || []) {
        const subject = String(item.subject || "공통").trim() || "공통";
        const current = subjectMap.get(subject) || { subject, total: 0, correct: 0 };
        current.total += Number(item.total || 0);
        current.correct += Number(item.correct || 0);
        subjectMap.set(subject, current);
      }
    }
    return [...subjectMap.values()]
      .map((item) => ({ ...item, score: item.total ? Math.round((item.correct / item.total) * 100) : 0 }))
      .sort((a, b) => a.score - b.score || b.total - a.total);
  }, [targeted]);

  const typeRows = useMemo(() => {
    const counts = new Map();
    attemptEvents.forEach((item) => {
      const key = item.learningType || "examPractice";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([id, count]) => ({ id, label: LEARNING_TYPE_LABELS[id] || id, count }))
      .sort((a, b) => b.count - a.count);
  }, [attemptEvents]);

  const masteryRows = useMemo(() => {
    const counts = { answered: 0, understanding: 0, proficient: 0, mastered: 0 };
    learningProgress.forEach((item) => {
      const stage = masteryStageForProgress(item).id;
      if (stage in counts) counts[stage] += 1;
    });
    return [
      ["풀이 완료", counts.answered],
      ["이해 중", counts.understanding],
      ["숙련", counts.proficient],
      ["마스터", counts.mastered],
    ];
  }, [learningProgress]);

  const totalSeconds = studyEvents.reduce((sum, event) => sum + Number(event.durationSeconds || 0), 0);
  const activeDays = new Set(studyEvents.map((event) => dayKey(event.createdAt)).filter(Boolean)).size;
  const recentRecords = useMemo(
    () => [...examHistory, ...practiceHistory].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 14),
    [examHistory, practiceHistory],
  );
  const recentDays = Array.from({ length: 28 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (27 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, active: studyEvents.some((event) => dayKey(event.createdAt) === key) };
  });

  async function recalculate() {
    setMaintenanceMessage("학습 데이터를 다시 계산하고 있습니다.");
    const result = await onRecalculate?.(maintenanceScope);
    setMaintenanceMessage(result?.message || "학습 데이터를 다시 계산했습니다.");
  }

  async function reset() {
    const targetName = maintenanceScope
      ? certificates.find((item) => item.id === maintenanceScope)?.name || "선택한 자격증"
      : "전체";
    if (!window.confirm(`${targetName} 학습 기록을 초기화할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    setMaintenanceMessage(`${targetName} 학습 기록을 초기화하고 있습니다.`);
    await onReset?.(maintenanceScope);
    setMaintenanceMessage(`${targetName} 학습 기록을 초기화했습니다.`);
  }

  return (
    <main className="page-shell">
      <section className="page-title">
        <div>
          <span className="eyebrow">CBT STUDY REPORT</span>
          <h1>CBT 학습 통계</h1>
          <p>학습 기록, 정답률, 숙련도 변화를 한눈에 확인하세요.</p>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="실전 풀이" value={`${examStats.total}문제`} />
        <StatCard label="실전 정답률" value={`${examStats.accuracy}%`} />
        <StatCard label="연습 풀이" value={`${practiceStats.total}문제`} />
        <StatCard label="누적 학습 기록" value={`${attemptEvents.length}개`} />
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>최근 4주 학습</h2>
          <div className="heatmap">{recentDays.map((day) => <span key={day.key} className={day.active ? "heat active" : "heat"} title={day.key} />)}</div>
          <p className="muted">학습한 날 {activeDays}일 · 누적 기록 시간 {Math.round(totalSeconds / 60)}분</p>
        </article>
        <article className="panel">
          <h2>학습 경로별 풀이</h2>
          <div className="learning-type-list">
            {typeRows.length ? typeRows.map((item) => (
              <div key={item.id}><span>{item.label}</span><strong>{item.count}문제</strong></div>
            )) : <p className="muted">아직 학습 기록이 없어요.</p>}
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>과목·주제 연습 정답률</h2>
          {subjectRows.length ? subjectRows.map((subject) => (
            <div className="subject-stat" key={subject.subject}>
              <div><span>{subject.subject}</span><strong>{subject.score}%</strong></div>
              <div className="mini-progress"><i style={{ width: `${subject.score}%` }} /></div>
              <small className="muted">{subject.total}문제 학습</small>
            </div>
          )) : <p className="muted">과목별 또는 주제별 학습 아직 기록이 없어요.</p>}
        </article>
        <article className="panel">
          <h2>문제 숙련 단계</h2>
          <div className="mastery-stage-grid">
            {masteryRows.map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}문제</strong></div>)}
          </div>
          <p className="muted">여러 날 반복해 맞히고 최근 자기평가가 ‘확실함’인 문제를 마스터로 표시합니다.</p>
        </article>
      </section>

      <section className="panel learning-data-maintenance">
        <div>
          <span className="eyebrow">DATA MAINTENANCE</span>
          <h2>학습 데이터 관리</h2>
          <p>학습 기록을 새로 정리해 중복을 제거하고 주제, 숙련도, 오답 통계를 최신 상태로 맞춥니다.</p>
        </div>
        <label>
          관리 범위
          <select value={maintenanceScope} onChange={(event) => setMaintenanceScope(event.target.value)}>
            <option value="">전체 자격증</option>
            {certificates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="maintenance-actions">
          <button type="button" className="primary" onClick={recalculate}>통계 다시 계산</button>
          <button type="button" className="maker-danger-ghost" onClick={reset}>학습 기록 초기화</button>
        </div>
        {maintenanceMessage && <p className="maintenance-message">{maintenanceMessage}</p>}
      </section>

      <section className="panel">
        <h2>최근 CBT 기록</h2>
        <div className="history-table">
          {recentRecords.map((item, index) => (
            <div className="history-row history-row-scoped" key={`${item.sessionId || item.createdAt}-${index}`}>
              <span>
                <b className={`history-scope ${item.assessmentType === "practice" ? "practice" : "exam"}`}>
                  {item.assessmentType === "practice" ? "연습" : "시험"}
                </b>
                {item.title}
              </span>
              <strong>{item.score}점 · {item.correct}/{item.total}</strong>
              <small>{new Date(item.createdAt).toLocaleString("ko-KR")}</small>
            </div>
          ))}
          {!recentRecords.length && <p className="muted">아직 기록이 없어요.</p>}
        </div>
      </section>
    </main>
  );
}
