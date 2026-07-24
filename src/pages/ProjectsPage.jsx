import React, { useEffect, useMemo, useState } from "react";
import { createBuildProject } from "../utils/makerPlatform";

function formatDate(value) {
  if (!value) return "날짜 없음";
  return new Date(value).toLocaleDateString("ko-KR");
}

function blankJournal() {
  return {
    id: `journal-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    title: "",
    content: "",
    progress: "",
    issue: "",
    nextAction: "",
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export default function ProjectsPage({ projects = [], inventorProjects = [], onChangeProjects, onOpenInvent }) {
  const [selectedId, setSelectedId] = useState(projects[0]?.id || "");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("overview");
  const [journalDraft, setJournalDraft] = useState(blankJournal());

  useEffect(() => {
    if (!projects.length) {
      setSelectedId("");
      return;
    }
    if (!projects.some((item) => item.id === selectedId)) setSelectedId(projects[0].id);
  }, [projects, selectedId]);

  const selected = projects.find((item) => item.id === selectedId) || null;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...projects]
      .filter((item) => !term || [item.title, item.problem, item.solution, item.role, ...(item.techStack || [])].join(" ").toLowerCase().includes(term))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [projects, query]);

  function updateProject(id, patch) {
    onChangeProjects(projects.map((item) => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  }

  function createManualProject() {
    const project = createBuildProject({
      tasks: [
        { id: `task-${Date.now()}-1`, title: "목표와 성공 기준 정리", done: false },
        { id: `task-${Date.now()}-2`, title: "첫 번째 결과물 제작", done: false },
      ],
    });
    onChangeProjects([project, ...projects]);
    setSelectedId(project.id);
    setTab("overview");
  }

  function duplicateProject(project) {
    const now = Date.now();
    const copy = JSON.parse(JSON.stringify(project));
    copy.id = `build-${now}`;
    copy.sourceInventId = "";
    copy.title = `${project.title} 복사본`;
    copy.createdAt = now;
    copy.updatedAt = now;
    copy.status = "active";
    copy.journals = (copy.journals || []).map((entry, index) => ({ ...entry, id: `journal-${now}-${index}` }));
    copy.tasks = (copy.tasks || []).map((task, index) => ({ ...task, id: `task-${now}-${index}` }));
    onChangeProjects([copy, ...projects]);
    setSelectedId(copy.id);
  }

  function deleteProject(project) {
    if (!window.confirm(`‘${project.title}’ 프로젝트를 삭제할까요? 프로젝트 일지도 함께 삭제됩니다.`)) return;
    const next = projects.filter((item) => item.id !== project.id);
    onChangeProjects(next);
    setSelectedId(next[0]?.id || "");
  }

  function saveJournal() {
    if (!selected || !journalDraft.title.trim()) {
      alert("일지 제목을 입력해 주세요.");
      return;
    }
    const journals = [...(selected.journals || [])];
    const index = journals.findIndex((entry) => entry.id === journalDraft.id);
    const nextEntry = {
      ...journalDraft,
      title: journalDraft.title.trim(),
      tags: Array.isArray(journalDraft.tags) ? journalDraft.tags : [],
      updatedAt: Date.now(),
    };
    if (index >= 0) journals[index] = nextEntry;
    else journals.unshift(nextEntry);
    updateProject(selected.id, { journals });
    setJournalDraft(blankJournal());
  }

  function editJournal(entry) {
    setJournalDraft({ ...entry, tags: Array.isArray(entry.tags) ? entry.tags : [] });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteJournal(entry) {
    if (!selected || !window.confirm(`‘${entry.title}’ 일지를 삭제할까요?`)) return;
    updateProject(selected.id, { journals: (selected.journals || []).filter((item) => item.id !== entry.id) });
    if (journalDraft.id === entry.id) setJournalDraft(blankJournal());
  }

  return <main className="maker-page projects-page projects-with-drawer">
    <aside className="maker-work-drawer project-drawer">
      <div className="work-drawer-head">
        <div><span>PROJECT DRAWER</span><strong>내 프로젝트</strong></div>
        <button className="drawer-new-button" onClick={createManualProject} aria-label="새 프로젝트">＋</button>
      </div>
      <label className="work-drawer-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="프로젝트 검색"/></label>
      <div className="work-drawer-meta"><span>{filtered.length}개</span><small>최근 수정순</small></div>
      <div className="work-drawer-list">
        {filtered.map((item) => <article key={item.id} className={`work-drawer-item ${item.id === selectedId ? "active" : ""}`}>
          <button className="work-drawer-select" onClick={() => { setSelectedId(item.id); setTab("overview"); }}>
            <span>{item.status === "done" ? "완료" : item.status === "paused" ? "보류" : "진행 중"}</span>
            <strong>{item.title}</strong>
            <small>{item.tasks?.filter((task) => task.done).length || 0}/{item.tasks?.length || 0}개 할 일 · 일지 {item.journals?.length || 0}개</small>
            <time>{formatDate(item.updatedAt)}</time>
          </button>
          <div className="work-drawer-actions"><button onClick={() => duplicateProject(item)}>복제</button><button className="danger" onClick={() => deleteProject(item)}>삭제</button></div>
        </article>)}
        {!filtered.length && <div className="drawer-empty"><strong>프로젝트가 없어요</strong><p>직접 만들거나 Invent 아이디어를 프로젝트로 전환할 수 있어요.</p></div>}
      </div>
      <button className="drawer-secondary-action" onClick={onOpenInvent}>Invent에서 시작하기</button>
    </aside>

    {!selected ? <section className="project-main-area"><section className="maker-empty-card"><span>BUILD</span><h1>아이디어를 실행 프로젝트로 바꾸세요.</h1><p>프로젝트를 직접 만들거나 Invent에서 정리한 아이디어를 전환해 목표·일정·할 일·일지를 한곳에서 관리할 수 있습니다.</p><div className="empty-action-row"><button className="maker-primary" onClick={createManualProject}>새 프로젝트</button><button className="maker-ghost" onClick={onOpenInvent}>Invent에서 시작</button></div></section></section> : <section className="project-main-area">
      <section className="project-detail-head">
        <div><span>PROJECT WORKSPACE</span><input value={selected.title} onChange={(e) => updateProject(selected.id, { title: e.target.value })}/><p>마지막 수정 {formatDate(selected.updatedAt)}</p></div>
        <div className="project-head-actions"><select value={selected.status} onChange={(e) => updateProject(selected.id, { status: e.target.value })}><option value="active">진행 중</option><option value="done">완료</option><option value="paused">보류</option></select><button className="maker-ghost" onClick={() => duplicateProject(selected)}>복제</button><button className="maker-danger-ghost" onClick={() => deleteProject(selected)}>삭제</button></div>
      </section>

      <nav className="project-tabs"><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>개요</button><button className={tab === "tasks" ? "active" : ""} onClick={() => setTab("tasks")}>할 일 <span>{selected.tasks?.length || 0}</span></button><button className={tab === "journal" ? "active" : ""} onClick={() => setTab("journal")}>프로젝트 일지 <span>{selected.journals?.length || 0}</span></button></nav>

      {tab === "overview" && <section className="maker-card project-detail project-overview-editor">
        <div className="project-form-grid">
          <label className="invent-field span-all"><span>문제 정의</span><textarea rows="4" value={selected.problem || ""} onChange={(e) => updateProject(selected.id, { problem: e.target.value })}/></label>
          <label className="invent-field span-all"><span>해결 아이디어</span><textarea rows="4" value={selected.solution || ""} onChange={(e) => updateProject(selected.id, { solution: e.target.value })}/></label>
          <label className="invent-field"><span>내 역할</span><input value={selected.role || ""} onChange={(e) => updateProject(selected.id, { role: e.target.value })} placeholder="예: 팀장·앱 개발·시스템 통합"/></label>
          <label className="invent-field"><span>팀 규모</span><input value={selected.teamSize || ""} onChange={(e) => updateProject(selected.id, { teamSize: e.target.value })} placeholder="예: 4명"/></label>
          <label className="invent-field"><span>시작일</span><input type="date" value={selected.startDate || ""} onChange={(e) => updateProject(selected.id, { startDate: e.target.value })}/></label>
          <label className="invent-field"><span>종료일</span><input type="date" value={selected.endDate || ""} onChange={(e) => updateProject(selected.id, { endDate: e.target.value })}/></label>
          <label className="invent-field span-all"><span>사용 기술</span><small>쉼표로 구분해 입력하세요.</small><input value={(selected.techStack || []).join(", ")} onChange={(e) => updateProject(selected.id, { techStack: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} placeholder="React, Firebase, PLC, Raspberry Pi"/></label>
          <label className="invent-field span-all"><span>이력서용 프로젝트 요약</span><small>문제·역할·행동·성과가 드러나는 2~4문장으로 작성하세요.</small><textarea rows="5" value={selected.resumeSummary || ""} onChange={(e) => updateProject(selected.id, { resumeSummary: e.target.value })} placeholder="예: 팀장으로 참여하여..."/></label>
          <label className="invent-field span-all"><span>성과 및 결과</span><textarea rows="4" value={selected.outcome || ""} onChange={(e) => updateProject(selected.id, { outcome: e.target.value })} placeholder="수상, 사용자 테스트 결과, 제작 완료 여부, 개선 수치 등"/></label>
        </div>
      </section>}

      {tab === "tasks" && <section className="maker-card project-detail">
        <div className="project-task-head"><div><h2>다음 행동</h2><p>작고 확인 가능한 단위로 나누면 프로젝트가 멈추지 않습니다.</p></div><button className="maker-primary" onClick={() => updateProject(selected.id, { tasks: [...(selected.tasks || []), { id: `task-${Date.now()}`, title: "새 할 일", done: false }] })}>할 일 추가</button></div>
        <div className="project-progress-card"><div><strong>{selected.tasks?.filter((task) => task.done).length || 0}</strong><span>/ {selected.tasks?.length || 0} 완료</span></div><i><b style={{ width: `${selected.tasks?.length ? (selected.tasks.filter((task) => task.done).length / selected.tasks.length) * 100 : 0}%` }}/></i></div>
        <div className="project-tasks">{(selected.tasks || []).map((task) => <label key={task.id}><input type="checkbox" checked={task.done} onChange={(e) => updateProject(selected.id, { tasks: selected.tasks.map((item) => item.id === task.id ? { ...item, done: e.target.checked } : item) })}/><input value={task.title} onChange={(e) => updateProject(selected.id, { tasks: selected.tasks.map((item) => item.id === task.id ? { ...item, title: e.target.value } : item) })}/><button type="button" onClick={() => updateProject(selected.id, { tasks: selected.tasks.filter((item) => item.id !== task.id) })}>삭제</button></label>)}</div>
      </section>}

      {tab === "journal" && <section className="project-journal-layout">
        <section className="maker-card project-journal-editor">
          <header><div><span>PROJECT JOURNAL</span><h2>{(selected.journals || []).some((entry) => entry.id === journalDraft.id) ? "일지 수정" : "오늘의 기록"}</h2></div>{(selected.journals || []).some((entry) => entry.id === journalDraft.id) && <button className="maker-ghost" onClick={() => setJournalDraft(blankJournal())}>새 일지</button>}</header>
          <div className="project-form-grid">
            <label className="invent-field"><span>날짜</span><input type="date" value={journalDraft.date || ""} onChange={(e) => setJournalDraft({ ...journalDraft, date: e.target.value })}/></label>
            <label className="invent-field"><span>제목</span><input value={journalDraft.title || ""} onChange={(e) => setJournalDraft({ ...journalDraft, title: e.target.value })} placeholder="예: 주문 흐름 연동 테스트"/></label>
            <label className="invent-field span-all"><span>오늘 한 일</span><textarea rows="5" value={journalDraft.content || ""} onChange={(e) => setJournalDraft({ ...journalDraft, content: e.target.value })} placeholder="무엇을 시도했고 어떤 결과가 나왔는지 기록하세요."/></label>
            <label className="invent-field"><span>진행 결과</span><textarea rows="3" value={journalDraft.progress || ""} onChange={(e) => setJournalDraft({ ...journalDraft, progress: e.target.value })} placeholder="완료한 것·확인된 것"/></label>
            <label className="invent-field"><span>문제 및 배운 점</span><textarea rows="3" value={journalDraft.issue || ""} onChange={(e) => setJournalDraft({ ...journalDraft, issue: e.target.value })} placeholder="오류, 원인, 배운 점"/></label>
            <label className="invent-field span-all"><span>다음 행동</span><input value={journalDraft.nextAction || ""} onChange={(e) => setJournalDraft({ ...journalDraft, nextAction: e.target.value })} placeholder="다음에 가장 먼저 할 일"/></label>
            <label className="invent-field span-all"><span>태그</span><input value={(journalDraft.tags || []).join(", ")} onChange={(e) => setJournalDraft({ ...journalDraft, tags: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} placeholder="테스트, 하드웨어, 오류 해결"/></label>
          </div>
          <button className="maker-primary maker-wide" onClick={saveJournal}>일지 저장</button>
        </section>
        <section className="project-journal-list">
          {(selected.journals || []).length ? [...selected.journals].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((entry) => <article className="maker-card project-journal-card" key={entry.id}>
            <header><div><span>{entry.date || formatDate(entry.createdAt)}</span><h3>{entry.title}</h3></div><div><button onClick={() => editJournal(entry)}>수정</button><button className="danger" onClick={() => deleteJournal(entry)}>삭제</button></div></header>
            {entry.content && <p>{entry.content}</p>}
            <div className="journal-detail-grid">{entry.progress && <div><span>진행 결과</span><p>{entry.progress}</p></div>}{entry.issue && <div><span>문제·배운 점</span><p>{entry.issue}</p></div>}{entry.nextAction && <div><span>다음 행동</span><p>{entry.nextAction}</p></div>}</div>
            {!!entry.tags?.length && <footer>{entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</footer>}
          </article>) : <div className="maker-card maker-inline-empty"><h3>아직 프로젝트 일지가 없어요</h3><p>시도·오류·개선 과정을 남기면 포트폴리오의 근거가 됩니다.</p></div>}
        </section>
      </section>}
    </section>}
  </main>;
}
