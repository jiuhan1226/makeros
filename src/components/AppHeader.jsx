import { useEffect, useRef, useState } from "react";

const CERTIFICATE_PAGES = new Set(["catalog", "certificate", "past", "subject", "topic", "mock", "bookmark", "learning", "report", "planner", "search"]);
const SCHOOL_PAGES = new Set(["library", "pdfstudy", "notes", "graph", "tutor"]);

function activeModule(active) {
  if (["partnerToday", "partnerPlan", "partnerCalendar", "timetable", "meals", "partnerGoals"].includes(active)) return "partner";
  if (CERTIFICATE_PAGES.has(active)) return "certificateLearn";
  if (SCHOOL_PAGES.has(active)) return "schoolLearn";
  if (active === "invent") return "invent";
  if (active === "projects") return "projects";
  if (active === "portfolio") return "portfolio";
  if (active === "career") return "career";
  if (active === "makerHome") return "legacy";
  return "partner";
}

export default function AppHeader({ active, onNavigate, certificateName, certificateShortcuts = [], onOpenCertificateGoal, onStartCertificateGoal, user, onLogin, onTutorial, isAdmin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const module = activeModule(active);
  const certificateHome = certificateName ? "certificate" : "catalog";
  const mainItems = [
    { key: "partnerToday", label: "오늘" },
    { key: "partnerPlan", label: "계획" },
    { key: "partnerCalendar", label: "캘린더" },
    { key: certificateHome, label: "자격증", module: "certificateLearn" },
    { key: "library", label: "내신", module: "schoolLearn" },
    { key: "partnerGoals", label: "목표" },
  ];
  const certificateItems = [
    [certificateHome, "학습 홈"],
    ["past", "기출문제"],
    ["subject", "과목별"],
    ["topic", "주제별"],
    ["bookmark", "오답·복습"],
    ["learning", "AI 추천 학습"],
    ["planner", "시험 계획"],
  ];
  const schoolItems = [
    ["library", "내신 자료"],
    ["notes", "AI 노트·개념카드"],
    ["graph", "개념 트리"],
    ["tutor", "AI 튜터"],
  ];
  const legacyItems = [["makerHome", "기존 MakerOS 홈"], ["invent", "발명"], ["projects", "프로젝트"], ["portfolio", "포트폴리오"], ["career", "기존 진로"]];
  const currentSubItems = module === "certificateLearn" ? certificateItems : module === "schoolLearn" ? schoolItems : [];

  function isMainActive(item) {
    if (item.key === "partnerCalendar" && ["timetable", "meals"].includes(active)) return true;
    return item.module ? module === item.module : active === item.key;
  }

  function navigate(key) {
    setMobileMenuOpen(false);
    if (moreMenuRef.current) moreMenuRef.current.open = false;
    onNavigate(key);
  }

  function openCertificateGoal(goalId, startCbt = false) {
    setMobileMenuOpen(false);
    if (moreMenuRef.current) moreMenuRef.current.open = false;
    if (startCbt) onStartCertificateGoal?.(goalId);
    else onOpenCertificateGoal?.(goalId);
  }

  function handleAccount() {
    setMobileMenuOpen(false);
    onLogin();
  }

  useEffect(() => { setMobileMenuOpen(false); }, [active]);
  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    const handleKeydown = (event) => {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      if (moreMenuRef.current) moreMenuRef.current.open = false;
    };
    const handleResize = () => window.innerWidth > 1080 && setMobileMenuOpen(false);
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.body.classList.remove("mobile-menu-open");
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileMenuOpen]);
  useEffect(() => {
    const closeOutside = (event) => {
      if (moreMenuRef.current?.open && !moreMenuRef.current.contains(event.target)) moreMenuRef.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return <>
    <header className="maker-header partner-header">
      <div className="maker-topbar">
        <button className="maker-brand" onClick={() => navigate("partnerToday")} aria-label="MakerOS 오늘">
          <span className="maker-brand-mark">M</span>
          <span><strong>MakerOS</strong><small>계획은 바뀌어도, 목표까지 함께.</small></span>
        </button>
        <nav className="maker-main-nav" aria-label="주요 메뉴">
          {mainItems.map((item) => <button key={`${item.key}:${item.label}`} className={isMainActive(item) ? "active" : ""} onClick={() => navigate(item.key)}>{item.label}</button>)}
        </nav>
        <div className="maker-header-actions">
          <button className="maker-help-button" onClick={onTutorial}>사용법</button>
          <button className="maker-search-button" onClick={() => navigate("knowledge")}>검색</button>
          <details className="maker-more-menu" ref={moreMenuRef}>
            <summary>더보기</summary>
            <div className="maker-more-popover">
              {!!certificateShortcuts.length && <>
                <span>내 자격증 바로가기</span>
                <div className="maker-more-certificates">
                  {certificateShortcuts.map((item) => <div key={item.goalId}>
                    <button type="button" onClick={() => openCertificateGoal(item.goalId)}><strong>{item.name}</strong><small>{item.supported ? "학습 홈" : "DB 없음"}</small></button>
                    <button type="button" className={item.supported ? "quick" : "unsupported"} onClick={() => openCertificateGoal(item.goalId, true)}>CBT</button>
                  </div>)}
                </div>
              </>}
              <span>다른 기능</span>
              <nav>
                <button type="button" onClick={() => navigate("catalog")}>전체 자격증</button>
                <button type="button" onClick={() => navigate("timetable")}>학교 시간표</button>
                <button type="button" onClick={() => navigate("meals")}>학교 급식</button>
                <button type="button" onClick={() => navigate("tutor")}>AI 튜터</button>
                <button type="button" onClick={() => navigate("makerHome")}>MakerOS 홈</button>
                <button type="button" onClick={() => navigate("invent")}>발명</button>
                <button type="button" onClick={() => navigate("projects")}>프로젝트</button>
                <button type="button" onClick={() => navigate("portfolio")}>포트폴리오</button>
                <button type="button" onClick={() => navigate("career")}>진로</button>
              </nav>
            </div>
          </details>
          {isAdmin && <button className="maker-admin-button" onClick={() => navigate("admin")}>관리자</button>}
          <button className="maker-account" onClick={handleAccount}>{user ? (user.displayName || user.email || "계정") : "로그인"}</button>
          <button type="button" className="maker-menu-button" aria-label="전체 메뉴 열기" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><span/><span/><span/></button>
        </div>
      </div>
      {!!currentSubItems.length && <div className="maker-subbar">
        <nav aria-label={module === "certificateLearn" ? "자격증 학습 메뉴" : "내신 학습 메뉴"}>
          {currentSubItems.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => navigate(key)}>{label}</button>)}
        </nav>
        {module === "certificateLearn" && certificateName && <span className="maker-context-chip">{certificateName}</span>}
        {module === "schoolLearn" && <span className="maker-context-chip neutral">내신 학습</span>}
      </div>}
    </header>

    <button type="button" className={`maker-mobile-menu-backdrop ${mobileMenuOpen ? "visible" : ""}`} aria-label="메뉴 닫기" onClick={() => setMobileMenuOpen(false)}/>
    <aside className={`maker-mobile-drawer ${mobileMenuOpen ? "open" : ""}`} aria-hidden={!mobileMenuOpen}>
      <header><div className="maker-mobile-drawer-brand"><span className="maker-brand-mark">M</span><div><strong>MakerOS</strong><small>목표와 학습을 한 번에 관리</small></div></div><button type="button" className="maker-drawer-close" onClick={() => setMobileMenuOpen(false)} aria-label="전체 메뉴 닫기">×</button></header>
      <div className="maker-mobile-drawer-scroll">
        <section><span>일정</span><nav>{mainItems.filter((item) => !item.module).map((item) => <button key={item.key} className={isMainActive(item) ? "active" : ""} onClick={() => navigate(item.key)}>{item.label}</button>)}<button className={active === "timetable" ? "active" : ""} onClick={() => navigate("timetable")}>학교 시간표</button><button className={active === "meals" ? "active" : ""} onClick={() => navigate("meals")}>학교 급식</button></nav></section>
        <section><span>내 자격증 바로가기</span><nav>{certificateShortcuts.length ? certificateShortcuts.map((item) => <button key={item.goalId} onClick={() => openCertificateGoal(item.goalId, true)}>{item.name} CBT{item.supported ? "" : " · DB 없음"}</button>) : <button onClick={() => navigate("partnerGoals")}>자격증 일정 추가</button>}</nav></section>
        <section><span>자격증</span><nav><button className={active === "catalog" ? "active" : ""} onClick={() => navigate("catalog")}>전체 자격증</button>{certificateItems.filter(([key]) => key !== "catalog").map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => navigate(key)}>{label}</button>)}</nav></section>
        <section><span>내신</span><nav>{schoolItems.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => navigate(key)}>{label}</button>)}</nav></section>
        <section><span>만들기·진로</span><nav>{legacyItems.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => navigate(key)}>{label}</button>)}</nav></section>
      </div>
      <footer><button type="button" onClick={() => { setMobileMenuOpen(false); onTutorial?.(); }}>사용법</button><button type="button" onClick={() => navigate("knowledge")}>통합 검색</button>{isAdmin && <button type="button" onClick={() => navigate("admin")}>관리자</button>}<button type="button" className="primary" onClick={handleAccount}>{user ? "계정 관리" : "로그인"}</button></footer>
    </aside>

    <nav className="maker-mobile-bottom-nav partner-mobile-nav" aria-label="모바일 빠른 메뉴">
      <button className={active === "partnerToday" ? "active" : ""} onClick={() => navigate("partnerToday")}><span>⌂</span><small>오늘</small></button>
      <button className={active === "partnerPlan" ? "active" : ""} onClick={() => navigate("partnerPlan")}><span>▤</span><small>계획</small></button>
      <button className={module === "certificateLearn" ? "active" : ""} onClick={() => navigate(certificateHome)}><span>▣</span><small>자격증</small></button>
      <button className={module === "schoolLearn" ? "active" : ""} onClick={() => navigate("library")}><span>□</span><small>내신</small></button>
      <button className={active === "partnerGoals" ? "active" : ""} onClick={() => navigate("partnerGoals")}><span>◎</span><small>목표</small></button>
    </nav>
  </>;
}
