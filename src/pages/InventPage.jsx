import React, { useEffect, useMemo, useState } from "react";
import { createInventorProject, inventStageLabel } from "../utils/makerPlatform";

const stages = [
  [1, "문제 발견", "누가 언제 무엇을 불편해하는지 정의"],
  [2, "원인 분석", "관찰한 원인과 근거를 구분"],
  [3, "아이디어 구체화", "해결 원리와 작동 방식을 설명"],
  [4, "검색 키워드", "자연어를 특허 검색어로 변환"],
  [5, "선행기술 비교", "유사점과 차이점을 근거로 정리"],
  [6, "가능성 분석", "신규성·진보성·실현 가능성을 교육적으로 점검"],
  [7, "권리화 연결", "발명노트와 권리화 초안을 준비"],
];

function Field({ label, hint, value, onChange, multiline = false }) {
  const Tag = multiline ? "textarea" : "input";
  return <label className="invent-field"><span>{label}</span>{hint && <small>{hint}</small>}<Tag value={value || ""} onChange={(event) => onChange(event.target.value)} rows={multiline ? 4 : undefined}/></label>;
}

function Score({ label, value, note }) {
  const number = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="invent-score"><div><span>{label}</span><strong>{number}</strong></div><i><b style={{ width: `${number}%` }}/></i><small>{note || "AI의 교육용 1차 분석이며 특허 등록 가능성을 보장하지 않습니다."}</small></div>;
}

function formatRelativeTime(value) {
  if (!value) return "저장 기록 없음";
  const gap = Date.now() - Number(value);
  if (gap < 60_000) return "방금 전";
  if (gap < 3_600_000) return `${Math.floor(gap / 60_000)}분 전`;
  if (gap < 86_400_000) return `${Math.floor(gap / 3_600_000)}시간 전`;
  return new Date(value).toLocaleDateString("ko-KR");
}

export default function InventPage({ projects = [], onChangeProjects, onCreateBuildProject }) {
  const [selectedId, setSelectedId] = useState(projects[0]?.id || "");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projects.length) {
      setSelectedId("");
      return;
    }
    if (!projects.some((item) => item.id === selectedId)) setSelectedId(projects[0].id);
  }, [projects, selectedId]);

  const current = projects.find((item) => item.id === selectedId) || null;
  const filteredProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...projects]
      .filter((item) => !term || [item.title, item.problem?.inconvenience, item.solution?.concept, ...(item.keywords || [])].join(" ").toLowerCase().includes(term))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [projects, query]);

  function createProject() {
    const project = createInventorProject();
    onChangeProjects([project, ...projects]);
    setSelectedId(project.id);
  }

  function update(patch) {
    if (!current) return;
    onChangeProjects(projects.map((item) => item.id === current.id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  }

  function updateNested(key, patch) {
    update({ [key]: { ...(current?.[key] || {}), ...patch } });
  }

  function setStage(stage) {
    update({ stage: Math.max(1, Math.min(7, stage)) });
  }

  function duplicateProject(project) {
    const now = Date.now();
    const copy = JSON.parse(JSON.stringify(project));
    copy.id = `invent-${now}`;
    copy.title = `${project.title} 복사본`;
    copy.createdAt = now;
    copy.updatedAt = now;
    copy.status = "draft";
    onChangeProjects([copy, ...projects]);
    setSelectedId(copy.id);
  }

  function deleteProject(project) {
    if (!window.confirm(`‘${project.title}’ 아이디어를 삭제할까요? 삭제한 내용은 복구할 수 없습니다.`)) return;
    const next = projects.filter((item) => item.id !== project.id);
    onChangeProjects(next);
    setSelectedId(next[0]?.id || "");
  }

  const context = useMemo(() => current ? {
    title: current.title,
    problem: current.problem,
    causes: current.causes,
    causeEvidence: current.causeEvidence,
    solution: current.solution,
    keywords: current.keywords,
    searchQueries: current.searchQueries,
    priorArtNotes: current.priorArtNotes,
    comparison: current.comparison,
    analysis: current.analysis,
  } : null, [current]);

  async function askCoach() {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/invent/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: current.stage, context }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "AI 발명 코치 분석에 실패했습니다.");
      const patch = { aiHistory: [{ stage: current.stage, createdAt: Date.now(), ...body }, ...(current.aiHistory || [])].slice(0, 30) };
      if (body.suggestedTitle) patch.title = body.suggestedTitle;
      if (body.causes?.length) patch.causes = body.causes;
      if (body.solution) patch.solution = { ...current.solution, ...body.solution };
      if (body.keywords?.length) patch.keywords = body.keywords;
      if (body.searchQueries) patch.searchQueries = body.searchQueries;
      if (body.comparison?.length) patch.comparison = body.comparison;
      if (body.analysis) patch.analysis = body.analysis;
      if (body.rightsDraft) patch.rightsDraft = body.rightsDraft;
      update(patch);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="maker-page invent-page invent-with-drawer">
    <aside className="maker-work-drawer">
      <div className="work-drawer-head">
        <div><span>IDEA DRAWER</span><strong>내 아이디어</strong></div>
        <button className="drawer-new-button" onClick={createProject} aria-label="새 아이디어">＋</button>
      </div>
      <label className="work-drawer-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="아이디어 검색"/></label>
      <div className="work-drawer-meta"><span>{filteredProjects.length}개</span><small>최근 수정순</small></div>
      <div className="work-drawer-list">
        {filteredProjects.map((item) => <article key={item.id} className={`work-drawer-item ${item.id === selectedId ? "active" : ""}`}>
          <button className="work-drawer-select" onClick={() => setSelectedId(item.id)}>
            <span>STEP {item.stage || 1} · {inventStageLabel(item.stage || 1)}</span>
            <strong>{item.title || "제목 없는 아이디어"}</strong>
            <small>{item.problem?.inconvenience || item.solution?.concept || "내용을 입력해 아이디어를 구체화하세요."}</small>
            <time>{formatRelativeTime(item.updatedAt)}</time>
          </button>
          <div className="work-drawer-actions">
            <button onClick={() => duplicateProject(item)}>복제</button>
            <button className="danger" onClick={() => deleteProject(item)}>삭제</button>
          </div>
        </article>)}
        {!filteredProjects.length && <div className="drawer-empty"><strong>저장된 아이디어가 없어요</strong><p>새 아이디어를 만들면 이곳에 자동 저장됩니다.</p></div>}
      </div>
    </aside>

    {!current ? <section className="invent-main-area"><section className="maker-empty-card"><span>AI INVENTOR</span><h1>불편함 하나가 발명의 시작입니다.</h1><p>아이디어가 완성되지 않아도 괜찮아요. MakerCore가 문제 정의부터 검색 키워드, 선행기술 비교와 권리화 준비까지 질문으로 안내합니다.</p><button className="maker-primary" onClick={createProject}>첫 아이디어 시작하기</button></section></section> : <section className="invent-main-area">
      <section className="invent-topbar">
        <div><span>AI INVENTOR</span><input className="invent-title-input" value={current.title} onChange={(e) => update({ title: e.target.value })}/><p>수정 내용은 이 기기에 자동 저장됩니다 · {formatRelativeTime(current.updatedAt)}</p></div>
        <div className="invent-top-actions"><button className="maker-ghost" onClick={() => duplicateProject(current)}>복제</button><button className="maker-danger-ghost" onClick={() => deleteProject(current)}>삭제</button><button className="maker-primary" onClick={createProject}>새 아이디어</button></div>
      </section>

      <section className="invent-layout">
        <aside className="invent-stage-list">{stages.map(([number, label, desc]) => <button key={number} className={`${current.stage === number ? "active" : ""} ${current.stage > number ? "done" : ""}`} onClick={() => setStage(number)}><b>{current.stage > number ? "✓" : number}</b><span><strong>{label}</strong><small>{desc}</small></span></button>)}</aside>
        <section className="maker-card invent-workspace">
          <header className="invent-work-head"><div><span>STEP {current.stage} OF 7</span><h1>{inventStageLabel(current.stage)}</h1><p>{stages.find(([number]) => number === current.stage)?.[2]}</p></div><button className="maker-primary" disabled={busy} onClick={askCoach}>{busy ? "AI가 정리 중…" : "MakerCore에게 검토받기"}</button></header>
          {error && <div className="maker-error">{error}</div>}

          {current.stage === 1 && <div className="invent-form-grid">
            <Field label="문제가 발생하는 상황" hint="장소·시간·작업 상황을 구체적으로 적어주세요." value={current.problem.situation} onChange={(v) => updateNested("problem", { situation: v })} multiline/>
            <Field label="불편을 겪는 사람" value={current.problem.targetUser} onChange={(v) => updateNested("problem", { targetUser: v })}/>
            <Field label="구체적인 불편" value={current.problem.inconvenience} onChange={(v) => updateNested("problem", { inconvenience: v })} multiline/>
            <Field label="발생 빈도" value={current.problem.frequency} onChange={(v) => updateNested("problem", { frequency: v })}/>
            <Field label="문제가 미치는 영향" value={current.problem.impact} onChange={(v) => updateNested("problem", { impact: v })} multiline/>
          </div>}

          {current.stage === 2 && <div className="invent-form-grid">
            <label className="invent-field span-all"><span>가능한 원인</span><small>한 줄에 하나씩 적어주세요. AI가 원인과 증상을 구분해 정리합니다.</small><textarea rows="8" value={(current.causes || []).join("\n")} onChange={(e) => update({ causes: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })}/></label>
            <Field label="관찰 또는 근거" hint="직접 본 상황, 인터뷰, 횟수 등을 적어주세요." value={current.causeEvidence} onChange={(v) => update({ causeEvidence: v })} multiline/>
          </div>}

          {current.stage === 3 && <div className="invent-form-grid">
            <Field label="해결 아이디어 한 문장" value={current.solution.concept} onChange={(v) => updateNested("solution", { concept: v })} multiline/>
            <Field label="작동 원리" hint="입력→처리→출력 또는 구조·동작 순서로 설명해보세요." value={current.solution.mechanism} onChange={(v) => updateNested("solution", { mechanism: v })} multiline/>
            <Field label="현실적인 제약" value={current.solution.constraints} onChange={(v) => updateNested("solution", { constraints: v })} multiline/>
            <Field label="기존 방식보다 개선되는 점" value={current.solution.improvements} onChange={(v) => updateNested("solution", { improvements: v })} multiline/>
          </div>}

          {current.stage === 4 && <div className="invent-analysis-stack">
            <div className="invent-keyword-editor"><h3>핵심 키워드</h3><p>AI가 만든 키워드를 직접 추가·삭제해 검색 품질을 높일 수 있습니다.</p><div>{(current.keywords || []).map((keyword, index) => <button key={`${keyword}-${index}`} onClick={() => update({ keywords: current.keywords.filter((_, i) => i !== index) })}>{keyword} ×</button>)}</div><input placeholder="키워드 입력 후 Enter" onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.value.trim()) { update({ keywords: [...(current.keywords || []), e.currentTarget.value.trim()] }); e.currentTarget.value = ""; } }}/></div>
            <div className="invent-query-grid"><article><span>한국어 검색식</span>{(current.searchQueries?.ko || []).map((q) => <code key={q}>{q}</code>)}</article><article><span>영문 검색식</span>{(current.searchQueries?.en || []).map((q) => <code key={q}>{q}</code>)}</article></div>
          </div>}

          {current.stage === 5 && <div className="invent-analysis-stack">
            <div className="invent-search-actions"><div><h3>선행기술 검색</h3><p>검색식은 AI가 만들고, 실제 문헌은 KIPRIS·Google Patents에서 확인합니다. 검색 결과의 제목·요약·차이점을 아래에 붙여 넣으세요.</p></div><div><button className="maker-ghost" onClick={() => { navigator.clipboard?.writeText((current.searchQueries?.ko || []).join("\n")); window.open("https://www.kipris.or.kr", "_blank", "noopener,noreferrer"); }}>KIPRIS 열기</button><button className="maker-ghost" onClick={() => window.open(`https://patents.google.com/?q=${encodeURIComponent((current.searchQueries?.en || current.keywords || []).join(" "))}`, "_blank", "noopener,noreferrer")}>Google Patents</button></div></div>
            <Field label="확인한 선행기술" hint="문헌번호, 제목, 핵심 구성, 내 아이디어와의 차이를 함께 적으면 분석이 정확해집니다." value={current.priorArtNotes} onChange={(v) => update({ priorArtNotes: v })} multiline/>
            {!!current.comparison?.length && <div className="invent-comparison-list">{current.comparison.map((item, index) => <article key={index}><strong>{item.title || `선행기술 ${index + 1}`}</strong><p><b>유사점</b> {item.similarity}</p><p><b>차이점</b> {item.difference}</p><small>{item.caution}</small></article>)}</div>}
          </div>}

          {current.stage === 6 && <div className="invent-analysis-stack">
            {!current.analysis ? <div className="maker-inline-empty"><h3>분석을 시작할 준비가 됐어요</h3><p>문제·원인·해결 원리와 직접 확인한 선행기술을 바탕으로 교육용 1차 분석을 제공합니다.</p></div> : <>
              <div className="invent-score-grid"><Score label="신규성" value={current.analysis.scores?.novelty} note={current.analysis.notes?.novelty}/><Score label="진보성" value={current.analysis.scores?.inventiveStep} note={current.analysis.notes?.inventiveStep}/><Score label="실현 가능성" value={current.analysis.scores?.feasibility} note={current.analysis.notes?.feasibility}/><Score label="명확성" value={current.analysis.scores?.clarity} note={current.analysis.notes?.clarity}/></div>
              <div className="invent-evidence-grid"><article><span>차별화 가능 요소</span><ul>{(current.analysis.differentiators || []).map((v) => <li key={v}>{v}</li>)}</ul></article><article><span>보완해야 할 점</span><ul>{(current.analysis.risks || []).map((v) => <li key={v}>{v}</li>)}</ul></article></div>
              <div className="invent-caution">이 결과는 발명 교육을 위한 AI의 1차 검토이며, 변리사의 법률 의견이나 특허 등록 가능성 판단을 대체하지 않습니다.</div>
            </>}
          </div>}

          {current.stage === 7 && <div className="invent-analysis-stack">
            {!current.rightsDraft ? <div className="maker-inline-empty"><h3>발명노트 초안을 만들 수 있어요</h3><p>앞 단계의 기록을 바탕으로 발명의 명칭, 해결 과제, 구성, 효과와 도면 계획을 정리합니다.</p></div> : <div className="rights-draft">
              <article><span>발명의 명칭</span><h3>{current.rightsDraft.title}</h3></article>
              <article><span>해결하려는 과제</span><p>{current.rightsDraft.problem}</p></article>
              <article><span>핵심 구성</span><ol>{(current.rightsDraft.components || []).map((v) => <li key={v}>{v}</li>)}</ol></article>
              <article><span>기대 효과</span><ul>{(current.rightsDraft.effects || []).map((v) => <li key={v}>{v}</li>)}</ul></article>
              <article><span>청구항 학습 예시</span><p>{current.rightsDraft.claimExample}</p><small>교육용 예시이며 실제 출원 문안이 아닙니다.</small></article>
              <article><span>도면 계획</span><ul>{(current.rightsDraft.drawings || []).map((v) => <li key={v}>{v}</li>)}</ul></article>
            </div>}
            <button className="maker-primary maker-wide" disabled={!current.rightsDraft} onClick={() => onCreateBuildProject(current)}>프로젝트로 전환하기</button>
          </div>}

          {(current.aiHistory || [])[0] && <aside className="invent-ai-feedback"><span>MakerCore 피드백</span><p>{current.aiHistory[0].coachMessage}</p>{current.aiHistory[0].questions?.length > 0 && <ul>{current.aiHistory[0].questions.map((q) => <li key={q}>{q}</li>)}</ul>}</aside>}
          <footer className="invent-footer"><button className="maker-ghost" disabled={current.stage === 1} onClick={() => setStage(current.stage - 1)}>이전</button><div><span>{current.stage}/7</span><i><b style={{ width: `${current.stage / 7 * 100}%` }}/></i></div><button className="maker-primary" disabled={current.stage === 7} onClick={() => setStage(current.stage + 1)}>다음 단계</button></footer>
        </section>
      </section>
    </section>}
  </main>;
}
