import React, { useState } from "react";

export default function DataManagementPage({ user, syncStatus = "device", counts = {}, onExport, onResetLearning, onResetPlan }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const syncLabel = user
    ? syncStatus === "synced" ? "로그인 계정과 동기화됨" : syncStatus === "error" ? "동기화 상태 확인 필요" : "계정 동기화 중"
    : "현재 브라우저에만 저장됨";

  async function resetLearning() {
    if (!window.confirm("CBT 풀이 기록, 오답, 학습 통계를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    setBusy("learning");
    try {
      await onResetLearning?.();
      setMessage("학습 기록을 삭제했습니다.");
    } finally {
      setBusy("");
    }
  }

  function resetPlan() {
    if (!window.confirm("목표, 일정, AI 계획을 모두 초기화할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    onResetPlan?.();
    setMessage("목표와 계획을 초기화했습니다.");
  }

  return <main className="partner-page data-management-page">
    <section className="partner-page-head">
      <div><span className="partner-kicker">MY DATA</span><h1>내 데이터 관리</h1><p>어디에 저장되는지 확인하고, 내보내거나 필요한 기록만 삭제할 수 있습니다.</p></div>
    </section>

    {message && <div className="partner-inline-notice" role="status">{message}</div>}

    <section className="data-overview-grid">
      <article className="partner-panel data-storage-card"><span>저장 상태</span><strong>{syncLabel}</strong><p>{user ? "학습·계획·성장 기록은 로그인 계정에서 다른 기기로 이어집니다." : "로그인하지 않으면 이 기기의 브라우저 저장소를 지울 때 기록도 사라질 수 있습니다."}</p></article>
      <article className="partner-panel data-count-card"><span>저장된 기록</span><div><b>{counts.exams || 0}<small>풀이</small></b><b>{counts.wrongNotes || 0}<small>오답</small></b><b>{counts.bookmarks || 0}<small>북마크</small></b><b>{counts.pdfs || 0}<small>PDF</small></b></div></article>
    </section>

    <section className="partner-panel data-action-section">
      <div><span>내보내기</span><h2>내 기록을 JSON 파일로 받기</h2><p>학습 결과, 목표·계획, PDF 목록, 이력서·진로 기록을 한 파일로 내려받습니다.</p></div>
      <button type="button" className="partner-primary" onClick={onExport}>전체 데이터 내보내기</button>
    </section>

    <section className="partner-panel data-action-section danger-zone">
      <div><span>선택 삭제</span><h2>필요 없는 기록만 초기화</h2><p>PDF 파일과 개념카드는 각 자료 화면에서 개별 삭제할 수 있습니다.</p></div>
      <div className="data-danger-actions">
        <button type="button" disabled={Boolean(busy)} onClick={resetLearning}>{busy === "learning" ? "삭제 중…" : "학습 기록 삭제"}</button>
        <button type="button" disabled={Boolean(busy)} onClick={resetPlan}>목표·계획 초기화</button>
      </div>
    </section>

    <aside className="data-ai-note"><strong>AI 기능 사용 안내</strong><p>AI 답변을 만들 때 필요한 질문과 선택한 학습자료만 서버로 전송합니다. 성적이나 자격 상태는 AI가 직접 변경하지 않습니다.</p></aside>
  </main>;
}
