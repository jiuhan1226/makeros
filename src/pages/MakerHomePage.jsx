import React, { useMemo } from "react";

function ModuleCard({ icon, eyebrow, title, description, action, onClick, tone = "blue", meta }) {
  return <button className={`maker-module-card tone-${tone}`} onClick={onClick}>
    <span className="maker-module-icon" aria-hidden="true">{icon}</span>
    <span className="maker-module-copy">
      <small>{eyebrow}</small>
      <strong>{title}</strong>
      <p>{description}</p>
      {meta && <em>{meta}</em>}
    </span>
    <span className="maker-module-action">{action} →</span>
  </button>;
}

export default function MakerHomePage({ onNavigate, history = [], wrongNotes = [], pdfLibrary = [], assets = {}, inventorProjects = [], buildProjects = [] }) {
  const recentInvent = inventorProjects[0];
  const studyCount = history.length + (assets.notes?.length || 0) + (assets.cards?.length || 0);
  const progress = useMemo(() => {
    const completed = inventorProjects.filter((item) => item.stage >= 6).length + buildProjects.filter((item) => item.status === "completed").length;
    return { completed, total: inventorProjects.length + buildProjects.length };
  }, [inventorProjects, buildProjects]);

  return <main className="maker-page maker-home-page">
    <section className="maker-hero">
      <div>
        <span className="maker-kicker">AI OPERATING SYSTEM FOR MAKERS</span>
        <h1>배우고, 만들고,<br/>성장하는 모든 과정을 한곳에서.</h1>
        <p>MakerOS는 직업계고 학생의 학습부터 발명, 프로젝트, 포트폴리오와 진로까지 연결합니다.</p>
        <div className="maker-hero-actions">
          <button className="maker-primary" onClick={() => onNavigate("invent")}>아이디어 시작하기</button>
          <button className="maker-ghost" onClick={() => onNavigate("catalog")}>학습 이어가기</button>
        </div>
      </div>
      <div className="maker-hero-status">
        <span>나의 성장 기록</span>
        <strong>{studyCount + inventorProjects.length + buildProjects.length}</strong>
        <p>학습·아이디어·프로젝트 활동</p>
        <div className="maker-progress"><i style={{ width: `${Math.min(100, progress.total ? progress.completed / progress.total * 100 : 12)}%` }}/></div>
        <small>{progress.completed}개의 결과물이 다음 단계로 연결됨</small>
      </div>
    </section>

    <section className="maker-today-grid">
      <article className="maker-card maker-next-card">
        <div className="maker-section-head">
          <div><span>오늘의 다음 행동</span><h2>{recentInvent ? "발명 아이디어를 한 단계 발전시켜 보세요" : "첫 아이디어를 문제에서 시작해 보세요"}</h2></div>
          <button onClick={() => onNavigate("invent")}>열기</button>
        </div>
        <p>{recentInvent ? `‘${recentInvent.title}’ 프로젝트가 ${recentInvent.stage}단계에 있습니다. AI 코치와 다음 질문을 해결해 보세요.` : "일상에서 불편했던 순간 하나만 적으면 AI가 문제 정의부터 선행기술 비교까지 안내합니다."}</p>
      </article>
      <article className="maker-card maker-snapshot-card">
        <span>학습 스냅샷</span>
        <div><strong>{pdfLibrary.length}</strong><small>PDF</small></div>
        <div><strong>{assets.notes?.length || 0}</strong><small>AI 노트</small></div>
        <div><strong>{wrongNotes.length}</strong><small>CBT 오답</small></div>
      </article>
    </section>

    <section className="maker-section">
      <div className="maker-section-title"><span>MakerOS 모듈</span><h2>지금 필요한 단계로 바로 이동하세요</h2></div>
      <div className="maker-module-grid">
        <ModuleCard icon="L" eyebrow="LEARN" title="AI 학습" description="PDF 학습 자료와 자격증 CBT를 분리해 AI 노트·단어카드·Learning Tree로 연결합니다." action="학습하기" onClick={() => onNavigate("catalog")} meta={`${pdfLibrary.length}개 자료`} tone="blue"/>
        <ModuleCard icon="I" eyebrow="INVENT" title="AI 발명 코치" description="문제 발견부터 선행기술 비교와 권리화 준비까지 단계별로 안내합니다." action="아이디어 발전" onClick={() => onNavigate("invent")} meta={`${inventorProjects.length}개 아이디어`} tone="violet"/>
        <ModuleCard icon="B" eyebrow="BUILD" title="프로젝트" description="아이디어를 실행 계획, 역할, 일정과 결과물로 연결합니다." action="프로젝트 보기" onClick={() => onNavigate("projects")} meta={`${buildProjects.length}개 프로젝트`} tone="green"/>
        <ModuleCard icon="P" eyebrow="SHOWCASE" title="포트폴리오" description="학습과 프로젝트 과정에서 나온 근거를 성장 기록으로 정리합니다." action="기록 정리" onClick={() => onNavigate("portfolio")} tone="orange"/>
        <ModuleCard icon="G" eyebrow="GROW" title="진로 로드맵" description="배운 기술과 만든 결과물을 직무·자격증·다음 프로젝트로 연결합니다." action="로드맵 보기" onClick={() => onNavigate("career")} tone="navy"/>
      </div>
    </section>
  </main>;
}
