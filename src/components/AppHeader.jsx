import { useEffect, useState } from "react";

function activeModule(active) {
  if (["invent"].includes(active)) return "invent";
  if (["projects"].includes(active)) return "projects";
  if (["portfolio"].includes(active)) return "portfolio";
  if (["career"].includes(active)) return "career";
  if (active === "makerHome") return "makerHome";
  return "learn";
}

export default function AppHeader({ active, onNavigate, certificateName, user, onLogin, isAdmin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  function navigate(key) {
    setMobileMenuOpen(false);
    onNavigate(key);
  }

  function handleAccount() {
    setMobileMenuOpen(false);
    onLogin();
  }

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [active]);

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    function handleKeydown(event) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    function handleResize() {
      if (window.innerWidth > 1080) setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.body.classList.remove("mobile-menu-open");
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileMenuOpen]);

  return <>
    <header className="maker-header">
      <div className="maker-topbar">
        <button className="maker-brand" onClick={() => navigate("makerHome")} aria-label="MakerOS 홈">
          <span className="maker-brand-mark">M</span>
          <span><strong>MakerOS</strong><small>Learn · Invent · Build</small></span>
        </button>
        <nav className="maker-main-nav" aria-label="주요 메뉴">
          {mainItems.map(([key, label]) => {
            const itemModule = key === "makerHome" ? "makerHome" : key === "invent" ? "invent" : key === "projects" ? "projects" : key === "portfolio" ? "portfolio" : key === "career" ? "career" : "learn";
            return <button key={key} className={module === itemModule ? "active" : ""} onClick={() => navigate(key)}>{label}</button>;
          })}
        </nav>
        <div className="maker-header-actions">
          <button className="maker-search-button" onClick={() => navigate("knowledge")}>검색</button>
          {isAdmin && <button className="maker-admin-button" onClick={() => navigate("admin")}>관리자</button>}
          <button className="maker-account" onClick={handleAccount}>{user ? (user.displayName || user.email || "계정") : "로그인"}</button>
          <button
            type="button"
            className="maker-menu-button"
            aria-label="전체 메뉴 열기"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
      {module === "learn" && <div className="maker-subbar">
        <nav aria-label="학습 메뉴">{learnItems.map(([key, label]) => <button key={key} className={active === key || (key === "past" && cbtActive) ? "active" : ""} onClick={() => navigate(key)}>{label}</button>)}</nav>
        {certificateName && cbtContextPages.has(active) && <span className="maker-context-chip">CBT · {certificateName}</span>}
        {pdfContextPages.has(active) && <span className="maker-context-chip neutral">PDF 독립 학습</span>}
      </div>}
      {module === "learn" && certificateName && cbtActive && <div className="maker-contextbar"><nav>{cbtItems.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => navigate(key)}>{label}</button>)}</nav><button onClick={() => navigate("catalog")}>종목 변경</button></div>}
    </header>

    <button
      type="button"
      className={`maker-mobile-menu-backdrop ${mobileMenuOpen ? "visible" : ""}`}
      aria-label="메뉴 닫기"
      onClick={() => setMobileMenuOpen(false)}
    />

    <aside className={`maker-mobile-drawer ${mobileMenuOpen ? "open" : ""}`} aria-hidden={!mobileMenuOpen}>
      <header>
        <div className="maker-mobile-drawer-brand">
          <span className="maker-brand-mark">M</span>
          <div><strong>MakerOS</strong><small>{certificateName || "학습과 프로젝트를 한곳에서"}</small></div>
        </div>
        <button type="button" className="maker-drawer-close" onClick={() => setMobileMenuOpen(false)} aria-label="전체 메뉴 닫기">×</button>
      </header>

      <div className="maker-mobile-drawer-scroll">
        <section>
          <span>주요 메뉴</span>
          <nav>{mainItems.map(([key, label]) => <button key={key} className={activeModule(key) === module ? "active" : ""} onClick={() => navigate(key)}>{label}</button>)}</nav>
        </section>

        <section>
          <span>학습 도구</span>
          <nav>{learnItems.map(([key, label]) => <button key={key} className={active === key || (key === "past" && cbtActive) ? "active" : ""} onClick={() => navigate(key)}>{label}</button>)}</nav>
        </section>

        {certificateName && <section>
          <span>{certificateName} CBT</span>
          <nav>{cbtItems.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => navigate(key)}>{label}</button>)}</nav>
        </section>}
      </div>

      <footer>
        <button type="button" onClick={() => navigate("knowledge")}>통합 검색</button>
        {isAdmin && <button type="button" onClick={() => navigate("admin")}>관리자</button>}
        <button type="button" className="primary" onClick={handleAccount}>{user ? "계정 관리" : "로그인"}</button>
      </footer>
    </aside>

    <nav className="maker-mobile-bottom-nav" aria-label="모바일 빠른 메뉴">
      <button className={active === "makerHome" ? "active" : ""} onClick={() => navigate("makerHome")}><span>⌂</span><small>홈</small></button>
      <button className={module === "learn" ? "active" : ""} onClick={() => navigate(certificateName ? "certificate" : "catalog")}><span>▣</span><small>학습</small></button>
      <button className={active === "knowledge" ? "active" : ""} onClick={() => navigate("knowledge")}><span>⌕</span><small>검색</small></button>
      <button className={mobileMenuOpen ? "active" : ""} onClick={() => setMobileMenuOpen(true)}><span>☰</span><small>더보기</small></button>
    </nav>
  </>;
}
