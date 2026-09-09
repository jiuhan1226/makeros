import React, { useEffect, useMemo, useState } from "react";
import { getActivePartnerPlan, getPendingPartnerPlan, normalizePartnerState, planDiff } from "../utils/aiPartner";

export default function PartnerPlanPage({ state, onGeneratePlan, onConfirmPending, onDiscardPending, onRollback, focusGoalId = "", busy = false }) {
  const [planView, setPlanView] = useState("all");
  const normalized = useMemo(() => normalizePartnerState(state), [state]);
  const active = getActivePartnerPlan(normalized);
  const pending = getPendingPartnerPlan(normalized);
  const shown = pending || active;
  const diff = pending && active ? planDiff(active, pending) : null;
  const history = normalized.planVersions.filter((item) => item.status === "superseded").slice(0, 5);
  const matchesPlanView = (type) => planView === "all" || (planView === "other" ? !["certificate", "academic"].includes(type) : type === planView);
  const visibleRoadmap = (shown?.roadmap || []).filter((goal) => matchesPlanView(goal.type));
  const visibleWeeks = (shown?.weeks || []).map((week) => {
    const items = (week.items || []).filter((item) => matchesPlanView(item.goalType));
    return { ...week, items, totalMinutes: items.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0) };
  }).filter((week) => week.items.length > 0);
  const planCounts = useMemo(() => (shown?.roadmap || []).reduce((counts, goal) => {
    const key = ["certificate", "academic"].includes(goal.type) ? goal.type : "other";
    counts[key] += 1;
    counts.all += 1;
    return counts;
  }, { all: 0, certificate: 0, academic: 0, other: 0 }), [shown]);
  const planViewLabels = { all: "전체 계획", certificate: "자격증", academic: "내신", other: "그 외 일정" };
  const displaySummary = String(shown?.summary || "").replace(/\s+\d+주 계획을/, " 계획을");

  useEffect(() => {
    if (!focusGoalId || !shown) return;
    const focusedGoal = (shown.roadmap || []).find((goal) => String(goal.goalId) === String(focusGoalId));
    if (focusedGoal) setPlanView(["certificate", "academic"].includes(focusedGoal.type) ? focusedGoal.type : "other");
    const timer = setTimeout(() => document.getElementById(`plan-goal-${focusGoalId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    return () => clearTimeout(timer);
  }, [focusGoalId, shown?.versionId]);

  return <main className="partner-page">
    <section className="partner-page-head">
      <div><span className="partner-kicker">DEADLINE ROADMAP</span><h1>AI가 나눈 학습 일정</h1><p>입력한 목표일부터 역산해 하루 분량을 자동 배치했습니다. 날짜가 바뀌면 기간도 다시 계산됩니다.</p></div>
      <button className="partner-primary" disabled={busy} onClick={onGeneratePlan}>{busy ? "계획 계산 중…" : active ? "재계획 만들기" : "첫 계획 만들기"}</button>
    </section>

    {pending && <section className="partner-diff-panel">
      <div><span>변경안</span><h2>{diff?.summary || "새 계획안"}</h2><p>현재 확정 계획은 그대로 유지 중입니다. 아래 내용을 확인하고 적용하거나 보류하세요.</p></div>
      <div className="partner-diff-metrics"><div><strong>{diff?.added.length || 0}</strong><span>추가</span></div><div><strong>{diff?.changed.length || 0}</strong><span>이동·분량</span></div><div><strong>{diff?.removed.length || 0}</strong><span>제거</span></div></div>
      <div className="partner-diff-actions"><button className="partner-secondary" onClick={onDiscardPending}>보류</button><button className="partner-primary" onClick={onConfirmPending}>이 변경안 적용</button></div>
    </section>}

    {!shown && <section className="partner-panel partner-empty"><strong>아직 계획 버전이 없습니다.</strong><p>목표와 가능한 시간을 입력한 뒤 첫 계획을 생성해 주세요.</p></section>}

    {shown && <>
      <nav className="partner-plan-tabs" aria-label="계획 종류 선택">
        {["all", "certificate", "academic", ...(planCounts.other ? ["other"] : [])].map((key) => <button type="button" key={key} className={planView === key ? "active" : ""} aria-pressed={planView === key} onClick={() => setPlanView(key)}><span>{planViewLabels[key]}</span><small>{planCounts[key]}</small></button>)}
      </nav>
      <section className="partner-panel">
        <div className="partner-section-title"><div><span>{pending ? "검토 중인 계획" : "현재 확정 계획"}</span><h2>{planView === "all" ? displaySummary : `${planViewLabels[planView]} 계획`}</h2></div><span className={`partner-status-chip ${pending ? "draft" : "active"}`}>{pending ? "확정 전" : "적용 중"}</span></div>
        <div className="partner-roadmap-grid">
          {visibleRoadmap.map((goal) => <article id={`plan-goal-${goal.goalId}`} className={`partner-roadmap-goal ${String(focusGoalId) === String(goal.goalId) ? "focus" : ""}`} key={goal.goalId}>
            <header><span>{goal.type === "academic" ? "내신" : goal.type === "certificate" ? "자격증" : goal.type === "career" ? "취업" : "대회·활동"}</span><strong>{goal.title}</strong><small>{goal.startDate && goal.deadline && goal.startDate !== goal.deadline ? `${goal.startDate} ~ ${goal.deadline}` : goal.deadline ? `목표일 ${goal.deadline}` : goal.startDate ? `시작일 ${goal.startDate}` : "장기 목표"}</small></header>
            <div>{(goal.milestones || []).map((item, index) => <div className="partner-milestone" key={item.id || index}><i>{index + 1}</i><span><strong>{item.title}</strong><small>{item.reason}</small></span></div>)}</div>
          </article>)}
        </div>
        {!visibleRoadmap.length && <div className="partner-simple-empty">등록된 {planViewLabels[planView]} 목표가 없습니다.</div>}
      </section>

      <section className="partner-panel">
        <div className="partner-section-title"><div><span>주간 계획</span><h2>입력한 기간에 맞춘 학습 분량</h2></div></div>
        <div className="partner-week-grid">
          {visibleWeeks.map((week) => <article key={week.weekIndex} className={week.weekIndex === 0 ? "current" : ""}><header><strong>{week.weekIndex === 0 ? "이번 주" : `${week.startsAt.slice(5).replace("-", ".")} 주간`}</strong><small>{week.startsAt} ~ {week.endsAt}</small></header><div className="partner-week-load"><i style={{ width: `${Math.min(100, (week.totalMinutes || 0) / Math.max(1, week.availableMinutes || shown.constraints?.weeklyAvailableMinutes || 480) * 100)}%` }}/></div><small>{Math.round((week.totalMinutes || 0) / 60 * 10) / 10}시간</small><ul>{(week.items || []).slice(0, 4).map((item) => <li key={item.id}>{item.title}</li>)}</ul>{(week.items || []).length > 4 && <small>외 {(week.items || []).length - 4}개 학습</small>}</article>)}
        </div>
        {!visibleWeeks.length && <div className="partner-simple-empty">목표 기간을 입력하고 계획을 다시 만들면 주간 분량이 표시됩니다.</div>}
      </section>
    </>}

    {!!history.length && <section className="partner-panel">
      <div className="partner-section-title"><div><span>계획 버전</span><h2>이전 확정 계획으로 되돌릴 수 있어요</h2></div></div>
      <div className="partner-version-list">{history.map((item) => <div key={item.versionId}><span><strong>{new Date(item.createdAt || Date.now()).toLocaleString("ko-KR")}</strong><small>{item.summary}</small></span><button className="partner-secondary small" onClick={() => onRollback(item.versionId)}>이 버전 복원</button></div>)}</div>
    </section>}
  </main>;
}
