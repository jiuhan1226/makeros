function activeModule(active) {
  if (["invent"].includes(active)) return "invent";
  if (["projects"].includes(active)) return "projects";
  if (["portfolio"].includes(active)) return "portfolio";
  if (["career"].includes(active)) return "career";
  if (["makerHome"].includes(active)) return "makerHome";
  return "learn";
}

export default function AppHeader({ active, onNavigate, certificateName, user, onLogin, isAdmin }) {
  const module = activeModule(active);
  const mainItems = [
    ["makerHome", "홈"],
    [certificateName ? "certificate" : "catalog", "학습"],
    ["invent", "발명"],
    ["projects", "프로젝트"],
    ["portfolio", "포트폴리오"],
    ["career", "진로"],
  ];
  const learnItems = [
    [certificateName ? "certificate" : "catalog", "학습 홈"],
    ["past", "CBT"],
    ["library", "PDF"],
    ["notes", "AI 노트·카드"],
    ["graph", "PDF Learning Tree"],
    ["tutor", "AI Tutor"],
    ["stats", "학습 기록"],
  ];
  const cbtItems = [
    ["past", "기출문제"], ["subject", "과목별"], ["topic", "주제별"],
    ["mock", "모의고사"], ["bookmark", "오답노트"], ["learning", "학습 코치"],
    ["report", "성장 리포트"], ["planner", "학습 플래너"],
  ];
  const cbtContextPages = new Set(["certificate", ...cbtItems.map(([key]) => key)]);
  const pdfContextPages = new Set(["library", "pdfstudy", "graph"]);
  const cbtActive = cbtItems.some(([key]) => key === active);

  return <header className="maker-header">
    <div className="maker-topbar">
      <button className="maker-brand" onClick={() => onNavigate("makerHome")} aria-label="MakerOS 홈">
        <span className="maker-brand-mark">M</span>
        <span><strong>MakerOS</strong><small>Learn · Invent · Build</small></span>
      </button>
      <nav className="maker-main-nav" aria-label="주요 메뉴">
        {mainItems.map(([key, label]) => {
          const itemModule = key === "makerHome" ? "makerHome" : key === "invent" ? "invent" : key === "projects" ? "projects" : key === "portfolio" ? "portfolio" : key === "career" ? "career" : "learn";
          return <button key={key} className={module === itemModule ? "active" : ""} onClick={() => onNavigate(key)}>{label}</button>;
        })}
      </nav>
      <div className="maker-header-actions">
        <button className="maker-search-button" onClick={() => onNavigate("knowledge")}>검색</button>
        {isAdmin && <button onClick={() => onNavigate("admin")}>관리자</button>}
        <button className="maker-account" onClick={onLogin}>{user ? (user.displayName || user.email || "계정") : "로그인"}</button>
      </div>
    </div>
    {module === "learn" && <div className="maker-subbar">
      <nav aria-label="학습 메뉴">{learnItems.map(([key, label]) => <button key={key} className={active === key || (key === "past" && cbtActive) ? "active" : ""} onClick={() => onNavigate(key)}>{label}</button>)}</nav>
      {certificateName && cbtContextPages.has(active) && <span className="maker-context-chip">CBT · {certificateName}</span>}
      {pdfContextPages.has(active) && <span className="maker-context-chip neutral">PDF 독립 학습</span>}
    </div>}
    {module === "learn" && certificateName && cbtActive && <div className="maker-contextbar"><nav>{cbtItems.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => onNavigate(key)}>{label}</button>)}</nav><button onClick={() => onNavigate("catalog")}>종목 변경</button></div>}
  </header>;
}
