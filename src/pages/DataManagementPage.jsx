import React, { useState } from "react";

export default function DataManagementPage({ user, syncStatus = "device", counts = {}, onExport, onResetLearning, onResetPlan, onDeleteAccount }) {
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

  async function deleteAccount() {
    if (!user) { setMessage("로그인한 계정이 없습니다."); return; }
    if (window.prompt("계정과 서버 데이터를 영구 삭제하려면 '계정삭제'를 입력하세요.") !== "계정삭제") return;
    setBusy("account");
    try {
      await onDeleteAccount?.();
      setMessage("계정과 저장된 서버 데이터를 삭제했습니다.");
    } catch (error) {
      setMessage(error?.code === "auth/requires-recent-login" ? "보안을 위해 다시 로그인한 뒤 계정 삭제를 진행해 주세요." : (error?.message || "계정을 삭제하지 못했습니다."));
    } finally { setBusy(""); }
  }

  return <main className="partner-page data-management-page">
    <section className="partner-page-head">
      <div><span className="partner-kicker">MY DATA</span><h1>내 데이터 관리</h1><p>어디에 저장되는지 확인하고, 내보내거나 필요한 기록만 삭제할 수 있습니다.</p></div>
    </section>

    {message && <div className="partner-inline-notice" role="status">{message}</div>}

    <section className="data-overview-grid">
      <article className="partner-panel data-storage-card"><span>저장 상태</span><strong>{syncLabel}</strong><p>{user ? "학습·계획·성장 기록은 로그인 계정에서 다른 기기로 이어집니다." : "로그인하지 않으면 이 기기의 브라우저 저장소를 지울 때 기록도 사라질 수 있습니다."}</p></article>
      <article className="partner-panel data-count-card"><span>저장된 기록</span><div><b>{counts.exams || 0}<small>풀이</small></b><b>{counts.wrongNotes || 0}<small>오답</small></b><b>{counts.bookmarks || 0}<small>북마크</small></b><b>{counts.pdfs || 0}<small>PDF</small></b><b>{counts.drafts || 0}<small>이어풀기</small></b></div></article>
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

    <section className="partner-panel data-policy-section">
      <div><span>개인정보·AI 처리</span><h2>저장 범위와 전송 내용을 확인하세요</h2></div>
      <details><summary>AI에 어떤 정보가 전송되나요?</summary><p>질문에 답하는 데 필요한 문제 본문, 사용자가 선택한 PDF 페이지, 첨부 이미지와 관련 학습 기록만 전송합니다. 비밀번호와 전체 이력서 정보는 AI 요청에 포함하지 않습니다.</p></details>
      <details><summary>데이터는 얼마나 보관되나요?</summary><p>기기 기록은 브라우저에서 직접 삭제할 때까지, 로그인 기록은 계정에서 삭제할 때까지 유지됩니다. PDF와 개념카드는 자료별 삭제가 가능하며 계정 삭제 시 서버 기록도 함께 삭제됩니다.</p></details>
      <details><summary>학생이 확인해야 할 점</summary><p>주민등록번호, 연락처, 타인의 얼굴처럼 학습에 필요하지 않은 개인정보는 PDF·이미지·자기소개서에 입력하지 마세요. AI 설명은 학습 보조이며 공식 정답과 제출 기준을 우선합니다.</p></details>
    </section>

    {user && <section className="partner-panel data-action-section account-delete-zone">
      <div><span>계정 삭제</span><h2>계정과 서버 데이터 영구 삭제</h2><p>학습 기록, 계획, PDF, 개념카드, 이력서·진로 기록과 CBT 이어풀기 데이터가 삭제되며 복구할 수 없습니다.</p></div>
      <button type="button" disabled={Boolean(busy)} onClick={deleteAccount}>{busy === "account" ? "삭제 중…" : "계정과 전체 데이터 삭제"}</button>
    </section>}

    <aside className="data-ai-note"><strong>AI 기능 사용 안내</strong><p>AI 답변을 만들 때 필요한 질문과 선택한 학습자료만 서버로 전송합니다. 성적이나 자격 상태는 AI가 직접 변경하지 않으며, AI 튜터와 해설은 일일 횟수 제한 없이 사용할 수 있습니다.</p></aside>
  </main>;
}
