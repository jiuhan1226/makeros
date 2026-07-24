import React, { useMemo, useState } from "react";

const emptyAward = { id: "", title: "", organization: "", result: "", date: "", description: "" };
const emptyCertification = { id: "", name: "", issuer: "", acquiredDate: "", credentialId: "", description: "" };
const emptyActivity = { id: "", type: "대외활동", title: "", organization: "", startDate: "", endDate: "", role: "", description: "" };

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function dateText(start, end) {
  if (!start && !end) return "기간 미입력";
  if (start && end) return `${start} ~ ${end}`;
  return start || end;
}

async function copyText(value, message = "복사했습니다.") {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(value || "");
    alert(message);
  } catch {
    alert("복사하지 못했습니다.");
  }
}

function ResumeSection({ title, children, empty }) {
  return <section className="resume-section"><h2>{title}</h2>{children || <p className="resume-empty-text">{empty}</p>}</section>;
}

export default function PortfolioPage({
  inventorProjects = [],
  buildProjects = [],
  history = [],
  assets = {},
  resumeProfile = {},
  onChangeResumeProfile,
  awards = [],
  onChangeAwards,
  certifications = [],
  onChangeCertifications,
  portfolioItems = [],
  onChangePortfolioItems,
}) {
  const [tab, setTab] = useState("resume");
  const [awardDraft, setAwardDraft] = useState(emptyAward);
  const [certDraft, setCertDraft] = useState(emptyCertification);
  const [activityDraft, setActivityDraft] = useState(emptyActivity);

  const journals = useMemo(() => buildProjects.flatMap((project) => (project.journals || []).map((entry) => ({ ...entry, projectId: project.id, projectTitle: project.title }))).sort((a, b) => String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt))), [buildProjects]);
  const completedProjects = buildProjects.filter((item) => item.status === "done").length;
  const skills = Array.isArray(resumeProfile.skills) ? resumeProfile.skills : [];

  const autoTimeline = useMemo(() => [
    ...buildProjects.map((item) => ({ type: "프로젝트", title: item.title, date: item.updatedAt, summary: item.resumeSummary || item.outcome || item.solution || item.problem || "프로젝트 수행 기록", status: item.status === "done" ? "완료" : "진행 중" })),
    ...inventorProjects.filter((item) => item.stage >= 3).map((item) => ({ type: "발명", title: item.title, date: item.updatedAt, summary: item.solution?.concept || item.problem?.inconvenience || "발명 아이디어 구체화 기록", status: `${item.stage}/7 단계` })),
    ...history.slice(0, 8).map((item) => ({ type: "학습", title: item.title, date: item.createdAt, summary: `${item.correct || 0}/${item.total || 0}문제 정답`, status: item.passed ? "합격" : "학습" })),
  ].sort((a, b) => b.date - a.date), [inventorProjects, buildProjects, history]);

  const resumePlainText = useMemo(() => {
    const lines = [
      resumeProfile.name || "이름",
      resumeProfile.desiredRole || "희망 직무",
      [resumeProfile.email, resumeProfile.phone, resumeProfile.location].filter(Boolean).join(" · "),
      "",
      "소개",
      resumeProfile.introduction || "",
      "",
      "기술",
      skills.join(", "),
      "",
      "프로젝트",
      ...buildProjects.flatMap((project) => [
        `${project.title} (${dateText(project.startDate, project.endDate)})`,
        [project.role, project.teamSize].filter(Boolean).join(" · "),
        project.resumeSummary || project.solution || "",
        project.outcome || "",
        project.techStack?.length ? `기술: ${project.techStack.join(", ")}` : "",
        "",
      ]),
      "수상 경력",
      ...awards.map((item) => `${item.date || ""} ${item.title} · ${item.organization || ""} · ${item.result || ""}\n${item.description || ""}`),
      "",
      "자격증",
      ...certifications.map((item) => `${item.acquiredDate || ""} ${item.name} · ${item.issuer || ""}${item.credentialId ? ` · ${item.credentialId}` : ""}`),
      "",
      "대외활동·교육",
      ...portfolioItems.map((item) => `${dateText(item.startDate, item.endDate)} ${item.title} · ${item.organization || ""}\n${item.description || ""}`),
    ];
    return lines.filter((line, index, arr) => line !== "" || arr[index - 1] !== "").join("\n").trim();
  }, [resumeProfile, skills, buildProjects, awards, certifications, portfolioItems]);

  function saveAward() {
    if (!awardDraft.title.trim()) return alert("수상명을 입력해 주세요.");
    const item = { ...awardDraft, id: awardDraft.id || makeId("award") };
    const exists = awards.some((entry) => entry.id === item.id);
    onChangeAwards(exists ? awards.map((entry) => entry.id === item.id ? item : entry) : [item, ...awards]);
    setAwardDraft(emptyAward);
  }

  function saveCertification() {
    if (!certDraft.name.trim()) return alert("자격증명을 입력해 주세요.");
    const item = { ...certDraft, id: certDraft.id || makeId("cert") };
    const exists = certifications.some((entry) => entry.id === item.id);
    onChangeCertifications(exists ? certifications.map((entry) => entry.id === item.id ? item : entry) : [item, ...certifications]);
    setCertDraft(emptyCertification);
  }

  function saveActivity() {
    if (!activityDraft.title.trim()) return alert("활동명을 입력해 주세요.");
    const item = { ...activityDraft, id: activityDraft.id || makeId("activity") };
    const exists = portfolioItems.some((entry) => entry.id === item.id);
    onChangePortfolioItems(exists ? portfolioItems.map((entry) => entry.id === item.id ? item : entry) : [item, ...portfolioItems]);
    setActivityDraft(emptyActivity);
  }

  return <main className="maker-page portfolio-page portfolio-resume-page">
    <section className="maker-page-head portfolio-page-head"><div><span>SHOWCASE</span><h1>포트폴리오 · 이력서</h1><p>수상, 자격증, 프로젝트와 과정 기록을 한곳에 모아 바로 제출할 수 있는 이력서 형태로 정리합니다.</p></div><div className="portfolio-head-actions"><button className="maker-ghost" onClick={() => copyText(resumePlainText, "이력서 내용을 복사했습니다.")}>텍스트 복사</button><button className="maker-primary" onClick={() => window.print()}>PDF로 저장·인쇄</button></div></section>

    <section className="portfolio-summary portfolio-summary-v2"><article><strong>{buildProjects.length}</strong><span>프로젝트</span></article><article><strong>{completedProjects}</strong><span>완료 프로젝트</span></article><article><strong>{awards.length}</strong><span>수상 경력</span></article><article><strong>{certifications.length}</strong><span>자격증</span></article><article><strong>{journals.length}</strong><span>프로젝트 일지</span></article></section>

    <nav className="portfolio-tabs"><button className={tab === "resume" ? "active" : ""} onClick={() => setTab("resume")}>이력서</button><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>기본 정보</button><button className={tab === "projects" ? "active" : ""} onClick={() => setTab("projects")}>프로젝트</button><button className={tab === "awards" ? "active" : ""} onClick={() => setTab("awards")}>수상</button><button className={tab === "certifications" ? "active" : ""} onClick={() => setTab("certifications")}>자격증</button><button className={tab === "activities" ? "active" : ""} onClick={() => setTab("activities")}>활동</button><button className={tab === "timeline" ? "active" : ""} onClick={() => setTab("timeline")}>성장 기록</button></nav>

    {tab === "resume" && <section className="resume-paper maker-card" id="makeros-resume">
      <header className="resume-header"><div><span>{resumeProfile.desiredRole || "희망 직무를 입력하세요"}</span><h1>{resumeProfile.name || "이름을 입력하세요"}</h1><p>{[resumeProfile.school, resumeProfile.major, resumeProfile.grade].filter(Boolean).join(" · ") || "학교·전공 정보를 입력하세요"}</p></div><address>{resumeProfile.email && <a href={`mailto:${resumeProfile.email}`}>{resumeProfile.email}</a>}{resumeProfile.phone && <span>{resumeProfile.phone}</span>}{resumeProfile.location && <span>{resumeProfile.location}</span>}</address></header>
      <ResumeSection title="PROFILE" empty="기본 정보 탭에서 한 줄 소개를 입력하세요.">{resumeProfile.introduction && <p className="resume-introduction">{resumeProfile.introduction}</p>}</ResumeSection>
      <ResumeSection title="SKILLS" empty="사용할 수 있는 기술을 등록하세요.">{skills.length > 0 && <div className="resume-skill-list">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>}</ResumeSection>
      <ResumeSection title="PROJECTS" empty="Build에서 프로젝트를 만들고 이력서용 요약을 작성하세요.">{buildProjects.length > 0 && <div className="resume-entry-list">{buildProjects.map((project) => <article className="resume-entry" key={project.id}><header><div><h3>{project.title}</h3><p>{[project.role, project.teamSize].filter(Boolean).join(" · ")}</p></div><time>{dateText(project.startDate, project.endDate)}</time></header><p>{project.resumeSummary || project.solution || project.problem || "프로젝트 설명을 입력하세요."}</p>{project.outcome && <p className="resume-result"><b>성과</b> {project.outcome}</p>}{!!project.techStack?.length && <footer>{project.techStack.map((tech) => <span key={tech}>{tech}</span>)}</footer>}</article>)}</div>}</ResumeSection>
      <div className="resume-two-column">
        <ResumeSection title="AWARDS" empty="수상 경력을 등록하세요.">{awards.length > 0 && <div className="resume-compact-list">{awards.map((item) => <article key={item.id}><time>{item.date || "날짜 미입력"}</time><div><h3>{item.title}</h3><p>{[item.organization, item.result].filter(Boolean).join(" · ")}</p>{item.description && <small>{item.description}</small>}</div></article>)}</div>}</ResumeSection>
        <ResumeSection title="CERTIFICATIONS" empty="자격증을 등록하세요.">{certifications.length > 0 && <div className="resume-compact-list">{certifications.map((item) => <article key={item.id}><time>{item.acquiredDate || "날짜 미입력"}</time><div><h3>{item.name}</h3><p>{item.issuer}{item.credentialId ? ` · ${item.credentialId}` : ""}</p>{item.description && <small>{item.description}</small>}</div></article>)}</div>}</ResumeSection>
      </div>
      <ResumeSection title="ACTIVITIES" empty="대외활동·교육·동아리 기록을 등록하세요.">{portfolioItems.length > 0 && <div className="resume-entry-list compact">{portfolioItems.map((item) => <article className="resume-entry" key={item.id}><header><div><h3>{item.title}</h3><p>{[item.type, item.organization, item.role].filter(Boolean).join(" · ")}</p></div><time>{dateText(item.startDate, item.endDate)}</time></header>{item.description && <p>{item.description}</p>}</article>)}</div>}</ResumeSection>
    </section>}

    {tab === "profile" && <section className="maker-card portfolio-editor-card"><header><div><span>RESUME PROFILE</span><h2>기본 정보</h2><p>입력한 내용은 이력서 미리보기에 즉시 반영됩니다.</p></div></header><div className="portfolio-form-grid">
      <label className="invent-field"><span>이름</span><input value={resumeProfile.name || ""} onChange={(e) => onChangeResumeProfile({ ...resumeProfile, name: e.target.value })}/></label>
      <label className="invent-field"><span>희망 직무</span><input value={resumeProfile.desiredRole || ""} onChange={(e) => onChangeResumeProfile({ ...resumeProfile, desiredRole: e.target.value })} placeholder="예: AI·소프트웨어 개발자"/></label>
      <label className="invent-field"><span>학교</span><input value={resumeProfile.school || ""} onChange={(e) => onChangeResumeProfile({ ...resumeProfile, school: e.target.value })}/></label>
      <label className="invent-field"><span>전공</span><input value={resumeProfile.major || ""} onChange={(e) => onChangeResumeProfile({ ...resumeProfile, major: e.target.value })}/></label>
      <label className="invent-field"><span>학년</span><input value={resumeProfile.grade || ""} onChange={(e) => onChangeResumeProfile({ ...resumeProfile, grade: e.target.value })}/></label>
      <label className="invent-field"><span>지역</span><input value={resumeProfile.location || ""} onChange={(e) => onChangeResumeProfile({ ...resumeProfile, location: e.target.value })}/></label>
      <label className="invent-field"><span>이메일</span><input type="email" value={resumeProfile.email || ""} onChange={(e) => onChangeResumeProfile({ ...resumeProfile, email: e.target.value })}/></label>
      <label className="invent-field"><span>연락처</span><input value={resumeProfile.phone || ""} onChange={(e) => onChangeResumeProfile({ ...resumeProfile, phone: e.target.value })}/></label>
      <label className="invent-field span-all"><span>한 줄 소개</span><textarea rows="5" value={resumeProfile.introduction || ""} onChange={(e) => onChangeResumeProfile({ ...resumeProfile, introduction: e.target.value })} placeholder="관심 분야, 강점, 경험을 2~4문장으로 정리하세요."/></label>
      <label className="invent-field span-all"><span>보유 기술</span><small>쉼표로 구분해 입력하세요.</small><input value={skills.join(", ")} onChange={(e) => onChangeResumeProfile({ ...resumeProfile, skills: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} placeholder="Python, Kotlin, PLC, Raspberry Pi, React"/></label>
    </div></section>}

    {tab === "projects" && <section className="portfolio-projects-grid">{buildProjects.length ? buildProjects.map((project) => <article className="maker-card portfolio-project-card" key={project.id}><header><div><span>{project.status === "done" ? "완료" : project.status === "paused" ? "보류" : "진행 중"}</span><h2>{project.title}</h2><p>{dateText(project.startDate, project.endDate)}</p></div><b>{project.journals?.length || 0}<small>일지</small></b></header><div className="portfolio-project-meta"><span>{project.role || "역할 미입력"}</span><span>{project.teamSize || "팀 규모 미입력"}</span></div><p>{project.resumeSummary || project.solution || "Build의 개요 탭에서 이력서용 프로젝트 요약을 입력하세요."}</p>{project.outcome && <aside><strong>성과</strong><p>{project.outcome}</p></aside>}<footer>{(project.techStack || []).map((tech) => <span key={tech}>{tech}</span>)}</footer></article>) : <div className="maker-card maker-inline-empty"><h3>등록된 프로젝트가 없어요</h3><p>Build에서 프로젝트를 만들면 자동으로 표시됩니다.</p></div>}</section>}

    {tab === "awards" && <section className="portfolio-management-layout"><section className="maker-card portfolio-editor-card"><header><div><span>AWARD</span><h2>{awardDraft.id ? "수상 경력 수정" : "수상 경력 등록"}</h2></div>{awardDraft.id && <button className="maker-ghost" onClick={() => setAwardDraft(emptyAward)}>새 항목</button>}</header><div className="portfolio-form-grid"><label className="invent-field span-all"><span>수상명</span><input value={awardDraft.title} onChange={(e) => setAwardDraft({ ...awardDraft, title: e.target.value })}/></label><label className="invent-field"><span>주최·수여기관</span><input value={awardDraft.organization} onChange={(e) => setAwardDraft({ ...awardDraft, organization: e.target.value })}/></label><label className="invent-field"><span>수상 결과</span><input value={awardDraft.result} onChange={(e) => setAwardDraft({ ...awardDraft, result: e.target.value })} placeholder="대상, 최우수상, 장려상 등"/></label><label className="invent-field"><span>수상일</span><input type="date" value={awardDraft.date} onChange={(e) => setAwardDraft({ ...awardDraft, date: e.target.value })}/></label><label className="invent-field span-all"><span>설명·기여 내용</span><textarea rows="4" value={awardDraft.description} onChange={(e) => setAwardDraft({ ...awardDraft, description: e.target.value })}/></label></div><button className="maker-primary maker-wide" onClick={saveAward}>저장</button></section><section className="portfolio-record-list">{awards.map((item) => <article className="maker-card portfolio-record-card" key={item.id}><header><div><span>{item.date || "날짜 미입력"}</span><h3>{item.title}</h3><p>{[item.organization, item.result].filter(Boolean).join(" · ")}</p></div><div><button onClick={() => setAwardDraft(item)}>수정</button><button className="danger" onClick={() => window.confirm(`‘${item.title}’을 삭제할까요?`) && onChangeAwards(awards.filter((entry) => entry.id !== item.id))}>삭제</button></div></header>{item.description && <p>{item.description}</p>}</article>)}{!awards.length && <div className="maker-card maker-inline-empty"><h3>수상 경력을 등록해 보세요</h3><p>공모전·교내대회·해커톤 등의 기록을 이력서에 바로 반영할 수 있습니다.</p></div>}</section></section>}

    {tab === "certifications" && <section className="portfolio-management-layout"><section className="maker-card portfolio-editor-card"><header><div><span>CERTIFICATION</span><h2>{certDraft.id ? "자격증 수정" : "자격증 등록"}</h2></div>{certDraft.id && <button className="maker-ghost" onClick={() => setCertDraft(emptyCertification)}>새 항목</button>}</header><div className="portfolio-form-grid"><label className="invent-field span-all"><span>자격증명</span><input value={certDraft.name} onChange={(e) => setCertDraft({ ...certDraft, name: e.target.value })}/></label><label className="invent-field"><span>발급기관</span><input value={certDraft.issuer} onChange={(e) => setCertDraft({ ...certDraft, issuer: e.target.value })}/></label><label className="invent-field"><span>취득일</span><input type="date" value={certDraft.acquiredDate} onChange={(e) => setCertDraft({ ...certDraft, acquiredDate: e.target.value })}/></label><label className="invent-field span-all"><span>자격번호</span><input value={certDraft.credentialId} onChange={(e) => setCertDraft({ ...certDraft, credentialId: e.target.value })}/></label><label className="invent-field span-all"><span>비고</span><textarea rows="3" value={certDraft.description} onChange={(e) => setCertDraft({ ...certDraft, description: e.target.value })}/></label></div><button className="maker-primary maker-wide" onClick={saveCertification}>저장</button></section><section className="portfolio-record-list">{certifications.map((item) => <article className="maker-card portfolio-record-card" key={item.id}><header><div><span>{item.acquiredDate || "취득일 미입력"}</span><h3>{item.name}</h3><p>{item.issuer}{item.credentialId ? ` · ${item.credentialId}` : ""}</p></div><div><button onClick={() => setCertDraft(item)}>수정</button><button className="danger" onClick={() => window.confirm(`‘${item.name}’을 삭제할까요?`) && onChangeCertifications(certifications.filter((entry) => entry.id !== item.id))}>삭제</button></div></header>{item.description && <p>{item.description}</p>}</article>)}{!certifications.length && <div className="maker-card maker-inline-empty"><h3>자격증 정보를 등록해 보세요</h3><p>취득일과 발급기관을 입력하면 이력서에 자동 정렬됩니다.</p></div>}</section></section>}

    {tab === "activities" && <section className="portfolio-management-layout"><section className="maker-card portfolio-editor-card"><header><div><span>ACTIVITY</span><h2>{activityDraft.id ? "활동 수정" : "활동 등록"}</h2></div>{activityDraft.id && <button className="maker-ghost" onClick={() => setActivityDraft(emptyActivity)}>새 항목</button>}</header><div className="portfolio-form-grid"><label className="invent-field"><span>구분</span><select value={activityDraft.type} onChange={(e) => setActivityDraft({ ...activityDraft, type: e.target.value })}><option>대외활동</option><option>교육</option><option>동아리</option><option>봉사</option><option>창업</option><option>기타</option></select></label><label className="invent-field"><span>활동명</span><input value={activityDraft.title} onChange={(e) => setActivityDraft({ ...activityDraft, title: e.target.value })}/></label><label className="invent-field"><span>기관</span><input value={activityDraft.organization} onChange={(e) => setActivityDraft({ ...activityDraft, organization: e.target.value })}/></label><label className="invent-field"><span>역할</span><input value={activityDraft.role} onChange={(e) => setActivityDraft({ ...activityDraft, role: e.target.value })}/></label><label className="invent-field"><span>시작일</span><input type="date" value={activityDraft.startDate} onChange={(e) => setActivityDraft({ ...activityDraft, startDate: e.target.value })}/></label><label className="invent-field"><span>종료일</span><input type="date" value={activityDraft.endDate} onChange={(e) => setActivityDraft({ ...activityDraft, endDate: e.target.value })}/></label><label className="invent-field span-all"><span>주요 활동 및 성과</span><textarea rows="5" value={activityDraft.description} onChange={(e) => setActivityDraft({ ...activityDraft, description: e.target.value })}/></label></div><button className="maker-primary maker-wide" onClick={saveActivity}>저장</button></section><section className="portfolio-record-list">{portfolioItems.map((item) => <article className="maker-card portfolio-record-card" key={item.id}><header><div><span>{item.type} · {dateText(item.startDate, item.endDate)}</span><h3>{item.title}</h3><p>{[item.organization, item.role].filter(Boolean).join(" · ")}</p></div><div><button onClick={() => setActivityDraft(item)}>수정</button><button className="danger" onClick={() => window.confirm(`‘${item.title}’을 삭제할까요?`) && onChangePortfolioItems(portfolioItems.filter((entry) => entry.id !== item.id))}>삭제</button></div></header>{item.description && <p>{item.description}</p>}</article>)}{!portfolioItems.length && <div className="maker-card maker-inline-empty"><h3>활동 기록을 등록해 보세요</h3><p>교육, 동아리, 대외활동, 봉사, 창업 경험을 이력서에 연결할 수 있습니다.</p></div>}</section></section>}

    {tab === "timeline" && <section className="portfolio-timeline-grid"><section className="maker-card portfolio-timeline"><header className="timeline-section-head"><div><span>AUTO TIMELINE</span><h2>성장 기록</h2></div><small>학습·발명·프로젝트에서 자동 수집</small></header>{autoTimeline.length ? autoTimeline.map((item, index) => <article key={`${item.type}-${item.title}-${index}`}><i/><div><span>{item.type} · {new Date(item.date).toLocaleDateString("ko-KR")}</span><h3>{item.title}</h3><p>{item.summary}</p><small>{item.status}</small></div></article>) : <div className="maker-inline-empty"><h3>아직 기록이 없어요</h3><p>학습을 완료하거나 Invent 아이디어를 프로젝트로 전환하면 자동으로 쌓입니다.</p></div>}</section><section className="project-journal-list portfolio-journal-list"><header className="timeline-section-head"><div><span>PROJECT EVIDENCE</span><h2>프로젝트 일지</h2></div><small>{journals.length}개</small></header>{journals.length ? journals.map((entry) => <article className="maker-card project-journal-card" key={`${entry.projectId}-${entry.id}`}><header><div><span>{entry.projectTitle} · {entry.date || "날짜 미입력"}</span><h3>{entry.title}</h3></div></header>{entry.content && <p>{entry.content}</p>}{entry.progress && <div className="journal-highlight"><strong>진행 결과</strong><p>{entry.progress}</p></div>}</article>) : <div className="maker-card maker-inline-empty"><h3>프로젝트 일지가 없어요</h3><p>Build의 프로젝트 일지 탭에서 과정과 배운 점을 기록하세요.</p></div>}</section></section>}
  </main>;
}
