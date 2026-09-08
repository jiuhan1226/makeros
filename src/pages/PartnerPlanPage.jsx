import React, { useMemo } from "react";
import { getActivePartnerPlan, getPendingPartnerPlan, normalizePartnerState, planDiff } from "../utils/aiPartner";

export default function PartnerPlanPage({ state, onGeneratePlan, onConfirmPending, onDiscardPending, onRollback, busy = false }) {
  const normalized = useMemo(() => normalizePartnerState(state), [state]);
  const active = getActivePartnerPlan(normalized);
  const pending = getPendingPartnerPlan(normalized);
  const shown = pending || active;
  const diff = pending && active ? planDiff(active, pending) : null;
  const history = normalized.planVersions.filter((item) => item.status === "superseded").slice(0, 5);

  return <main className="partner-page">
    <section className="partner-page-head">
      <div><span className="partner-kicker">12-WEEK ROADMAP</span><h1>AI가 나눈 학습 일정</h1><p>입력한 마감과 가능한 시간을 기준으로 하루 분량을 자동 배치했습니다. 새 정보가 생기면 다시 계산됩니다.</p></div>
      <button className="partner-primary" disabled={busy} onClick={onGeneratePlan}>{busy ? "계획 계산 중…" : active ? "재계획 만들기" : "첫 계획 만들기"}</button>
    </section>

    {pending && <section className="partner-diff-panel">
      <div><span>변경안</span><h2>{diff?.summary || "새 계획안"}</h2><p>현재 확정 계획은 그대로 유지 중입니다. 아래 내용을 확인하고 적용하거나 보류하세요.</p></div>
      <div className="partner-diff-metrics"><div><strong>{diff?.added.length || 0}</strong><span>추가</span></div><div><strong>{diff?.changed.length || 0}</strong><span>이동·분량</span></div><div><strong>{diff?.removed.length || 0}</strong><span>제거</span></div></div>
      <div className="partner-diff-actions"><button className="partner-secondary" onClick={onDiscardPending}>보류</button><button className="partner-primary" onClick={onConfirmPending}>이 변경안 적용</button></div>
    </section>}

    {!shown && <section className="partner-panel partner-empty"><strong>아직 계획 버전이 없습니다.</strong><p>목표와 가능한 시간을 입력한 뒤 첫 계획을 생성해 주세요.</p></section>}

    {shown && <>
      <section className="partner-panel">
        <div className="partner-section-title"><div><span>{pending ? "검토 중인 계획" : "현재 확정 계획"}</span><h2>{shown.summary}</h2></div><span className={`partner-status-chip ${pending ? "draft" : "active"}`}>{pending ? "확정 전" : "적용 중"}</span></div>
        <div className="partner-roadmap-grid">
          {(shown.roadmap || []).map((goal) => <article className="partner-roadmap-goal" key={goal.goalId}>
            <header><span>{goal.type === "academic" ? "내신" : goal.type === "certificate" ? "자격증" : goal.type === "career" ? "취업" : "대회·활동"}</span><strong>{goal.title}</strong><small>{goal.deadline ? `목표일 ${goal.deadline}` : "장기 목표"}</small></header>
            <div>{(goal.milestones || []).map((item, index) => <div className="partner-milestone" key={item.id || index}><i>{index + 1}</i><span><strong>{item.title}</strong><small>{item.reason}</small></span></div>)}</div>
          </article>)}
        </div>
      </section>

      <section className="partner-panel">
        <div className="partner-section-title"><div><span>주간 계획</span><h2>12주 동안 분량을 가능한 시간 안에 배치</h2></div></div>
        <div className="partner-week-grid">
          {(shown.weeks || []).map((week) => <article key={week.weekIndex} className={week.weekIndex === 0 ? "current" : ""}><header><strong>{week.weekIndex === 0 ? "이번 주" : `${week.weekIndex + 1}주차`}</strong><small>{week.startsAt} ~ {week.endsAt}</small></header><div className="partner-week-load"><i style={{ width: `${Math.min(100, (week.totalMinutes || 0) / Math.max(1, shown.constraints?.weeklyAvailableMinutes || 480) * 100)}%` }}/></div><small>{Math.round((week.totalMinutes || 0) / 60 * 10) / 10}시간</small><ul>{(week.items || []).slice(0, 4).map((item) => <li key={item.id}>{item.title}</li>)}</ul></article>)}
        </div>
      </section>
    </>}

    {!!history.length && <section className="partner-panel">
      <div className="partner-section-title"><div><span>계획 버전</span><h2>이전 확정 계획으로 되돌릴 수 있어요</h2></div></div>
      <div className="partner-version-list">{history.map((item) => <div key={item.versionId}><span><strong>{new Date(item.createdAt || Date.now()).toLocaleString("ko-KR")}</strong><small>{item.summary}</small></span><button className="partner-secondary small" onClick={() => onRollback(item.versionId)}>이 버전 복원</button></div>)}</div>
    </section>}
  </main>;
}
