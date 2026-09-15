import React, { useEffect, useMemo, useState } from "react";
import { postJson } from "../utils/api";

const dimensions = [
  { key: "software", name: "AI·소프트웨어", regex: /ai|인공지능|소프트웨어|코딩|프로그래밍|앱|서버|웹|데이터|firebase|python|kotlin|react/i },
  { key: "electronics", name: "전기·전자", regex: /전기|전자|회로|반도체|plc|모터|센서|트랜지스터|다이오드|제어/i },
  { key: "invent", name: "발명·지식재산", regex: /발명|특허|선행기술|권리|아이디어|신규성|진보성|청구항/i },
  { key: "project", name: "프로젝트 실행", regex: /프로젝트|일정|역할|협업|발표|프로토타입|테스트|개선|완료/i },
  { key: "automation", name: "제조·자동화", regex: /자동화|로봇|제조|공정|기계|스마트팩토리|설비|공압|로봇팔/i },
];

function exactPercentages(values) {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || values.length;
  const raw = values.map((value) => (Math.max(0, value) / total) * 100);
  const base = raw.map(Math.floor);
  let left = 100 - base.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, remain: value - base[index] })).sort((a, b) => b.remain - a.remain);
  for (let i = 0; i < left; i += 1) base[order[i % order.length].index] += 1;
  return base;
}

function ratio(left, right) {
  const total = Math.max(1, left + right);
  return Math.round((left / total) * 100);
}

function keywordEvidence(items, regex) {
  return items.reduce((score, item) => score + (regex.test(String(item)) ? 1 : 0), 0);
}

export default function CareerPage({
  assets = {},
  inventorProjects = [],
  buildProjects = [],
  pdfLibrary = [],
  history = [],
  awards = [],
  certifications = [],
  portfolioItems = [],
  careerProfile = {},
  onChangeCareerProfile,
  onNavigate,
}) {
  const analysis = useMemo(() => {
    const notes = assets.notes || [];
    const cards = assets.cards || [];
    const textItems = [
      ...notes.map((item) => `${item.title} ${item.summary} ${(item.keyPoints || []).join(" ")}`),
      ...cards.map((item) => `${item.front} ${item.back}`),
      ...pdfLibrary.map((item) => item.name),
      ...inventorProjects.map((item) => JSON.stringify(item)),
      ...buildProjects.map((item) => `${item.title} ${item.problem} ${item.solution} ${(item.techStack || []).join(" ")} ${item.resumeSummary || ""}`),
    ];

    const completedTasks = buildProjects.flatMap((project) => project.tasks || []).filter((task) => task.done).length;
    const journals = buildProjects.flatMap((project) => project.journals || []).length;
    const completedProjects = buildProjects.filter((project) => project.status === "completed").length;

    const rawScores = dimensions.map((dimension) => {
      let score = 1 + keywordEvidence(textItems, dimension.regex);
      if (dimension.key === "invent") score += inventorProjects.reduce((sum, project) => sum + Math.max(1, Number(project.stage) || 1) * 0.8, 0);
      if (dimension.key === "project") score += buildProjects.length * 3 + completedTasks * 0.5 + journals * 0.8;
      if (dimension.key === "software") score += keywordEvidence(buildProjects.flatMap((project) => project.techStack || []), dimension.regex) * 2;
      if (dimension.key === "electronics" || dimension.key === "automation") score += keywordEvidence(buildProjects.flatMap((project) => project.techStack || []), dimension.regex) * 2;
      return score;
    });
    const distributed = exactPercentages(rawScores);
    const tendencies = dimensions.map((dimension, index) => ({ ...dimension, score: distributed[index], evidence: Math.round(rawScores[index] - 1) })).sort((a, b) => b.score - a.score);

    const learningActivity = pdfLibrary.length * 2 + notes.length * 0.6 + cards.length * 0.15 + history.length * 2;
    const makingActivity = inventorProjects.length * 3 + buildProjects.length * 5 + completedTasks + journals * 2;
    const ideaActivity = inventorProjects.reduce((sum, project) => sum + Math.max(1, Number(project.stage) || 1), 0) + notes.length * 0.1;
    const executionActivity = buildProjects.length * 3 + completedTasks * 1.5 + journals * 2 + completedProjects * 4;
    const softwareActivity = rawScores[0];
    const hardwareActivity = rawScores[1] + rawScores[4];
    const topShare = Math.max(...distributed);
    const activeDimensions = distributed.filter((value) => value >= 15).length;

    const axes = [
      { leftCode: "L", rightCode: "M", left: "학습·탐구", right: "제작·실행", leftValue: ratio(learningActivity + 1, makingActivity + 1) },
      { leftCode: "I", rightCode: "E", left: "아이디어", right: "구현", leftValue: ratio(ideaActivity + 1, executionActivity + 1) },
      { leftCode: "S", rightCode: "H", left: "소프트웨어", right: "하드웨어", leftValue: ratio(softwareActivity + 1, hardwareActivity + 1) },
      { leftCode: "F", rightCode: "V", left: "집중형", right: "융합형", leftValue: Math.max(0, Math.min(100, 45 + (topShare - 25) * 2 - Math.max(0, activeDimensions - 2) * 5)) },
    ].map((axis) => ({ ...axis, rightValue: 100 - axis.leftValue, selected: axis.leftValue >= 50 ? axis.leftCode : axis.rightCode }));

    const code = axes.map((axis) => axis.selected).join("");
    const top = tendencies[0];
    const executionSelected = axes[1].selected === "E";
    const typeName = top.key === "software"
      ? executionSelected ? "AI 프로토타이퍼형" : "AI 서비스 설계형"
      : top.key === "electronics" || top.key === "automation"
        ? executionSelected ? "스마트팩토리 메이커형" : "산업기술 탐구형"
        : top.key === "invent"
          ? "발명 전략가형"
          : "프로젝트 빌더형";

    const learningProgress = Math.min(100, Math.round(pdfLibrary.length * 8 + notes.length * 1.2 + history.length * 6));
    const projectProgress = Math.min(100, Math.round(buildProjects.length * 12 + completedTasks * 5 + journals * 7 + completedProjects * 20));
    const proofProgress = Math.min(100, Math.round(certifications.length * 18 + awards.length * 15 + completedProjects * 20 + buildProjects.filter((project) => project.resumeSummary).length * 10));

    return {
      tendencies,
      axes,
      code,
      typeName,
      top,
      counts: { notes: notes.length, cards: cards.length, pdfs: pdfLibrary.length, inventions: inventorProjects.length, projects: buildProjects.length, completedTasks, journals, awards: awards.length, certifications: certifications.length },
      roadmap: [
        { step: 1, title: `${top.name} 기초 역량 정리`, progress: learningProgress, detail: learningProgress ? "PDF·AI 노트·CBT 학습 기록을 직무 역량으로 연결합니다." : "관련 교과 PDF 또는 자격증 학습을 시작하세요.", action: "학습 자료와 자격증 목표 1개를 정리" },
        { step: 2, title: "작은 프로토타입으로 증명", progress: projectProgress, detail: "아이디어를 Build 프로젝트로 전환하고 할 일·일지·테스트 결과를 남깁니다.", action: projectProgress ? "미완료 작업과 프로젝트 일지를 보완" : "Invent 아이디어 1개를 프로젝트로 전환" },
        { step: 3, title: "이력서에 넣을 근거 완성", progress: proofProgress, detail: "프로젝트 성과, 자격증, 수상, 역할을 포트폴리오 문장으로 정리합니다.", action: "성과 수치와 본인 기여를 한 문장으로 기록" },
      ],
    };
  }, [assets, inventorProjects, buildProjects, pdfLibrary, history, awards, certifications]);

  const jobMap = {
    software: ["AI 서비스 개발자", "응용 소프트웨어 개발자", "스마트팩토리 SW 개발자"],
    electronics: ["전기제어 기술자", "반도체 장비 엔지니어", "전자제품 개발 기술자"],
    invent: ["R&D 기획", "제품개발", "기술사업화·지식재산 실무"],
    project: ["기술 프로젝트 매니저", "제품 운영·기획", "현장 개선 담당자"],
    automation: ["자동화설비 기술자", "로봇 시스템 엔지니어", "스마트팩토리 기술자"],
  };
  const jobs = jobMap[analysis.top?.key] || jobMap.software;
  const [selectedJob, setSelectedJob] = useState(jobs[0]);
  const [tab, setTab] = useState("roadmap");
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [recordForm, setRecordForm] = useState({ section: "진로활동", activity: "", role: "", action: "", result: "", learning: "", nextStep: "" });
  const [milestoneForm, setMilestoneForm] = useState({ phase: "이번 학기", title: "", deadline: "", evidence: "" });
  const roadmapMilestones = Array.isArray(careerProfile.roadmapMilestones) ? careerProfile.roadmapMilestones : [];
  const studentRecordDrafts = Array.isArray(careerProfile.studentRecordDrafts) ? careerProfile.studentRecordDrafts : [];

  function updateCareer(patch) {
    onChangeCareerProfile?.({ ...careerProfile, ...patch, updatedAt: Date.now() });
  }

  function addMilestone() {
    if (!milestoneForm.title.trim()) return;
    updateCareer({ roadmapMilestones: [...roadmapMilestones, { ...milestoneForm, id: `career-step-${Date.now()}`, title: milestoneForm.title.trim(), evidence: milestoneForm.evidence.trim(), done: false }] });
    setMilestoneForm({ phase: milestoneForm.phase, title: "", deadline: "", evidence: "" });
  }

  function patchMilestone(id, patch) {
    updateCareer({ roadmapMilestones: roadmapMilestones.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  async function generateStudentRecord() {
    if (!recordForm.activity.trim() || !recordForm.action.trim()) {
      setRecordError("무엇을 했는지와 실제 행동을 먼저 입력해 주세요.");
      return;
    }
    setRecordBusy(true); setRecordError("");
    try {
      const result = await postJson("/api/career/student-record-assist", {
        section: recordForm.section,
        facts: recordForm,
        career: { targetRole: careerProfile.targetRole || selectedJob, targetCompany: careerProfile.targetCompany || "" },
        evidence: {
          projects: buildProjects.slice(0, 12).map((item) => ({ title: item.title, role: item.role, outcome: item.outcome, resumeSummary: item.resumeSummary })),
          awards: awards.slice(0, 12),
          certifications: certifications.slice(0, 12),
          activities: portfolioItems.slice(0, 12),
        },
      }, "생기부 활동 기록 초안을 만들지 못했습니다.");
      setRecordForm((current) => ({ ...current, draft: result.draft || "", missingFacts: result.missingFacts || [], caution: result.caution || "" }));
    } catch (error) { setRecordError(error.message); }
    finally { setRecordBusy(false); }
  }

  function saveStudentRecord() {
    if (!recordForm.draft?.trim()) return;
    updateCareer({ studentRecordDrafts: [{ id: `student-record-${Date.now()}`, ...recordForm, createdAt: Date.now() }, ...studentRecordDrafts] });
    setRecordForm({ section: recordForm.section, activity: "", role: "", action: "", result: "", learning: "", nextStep: "" });
  }

  useEffect(() => {
    if (!jobs.includes(selectedJob)) setSelectedJob(jobs[0]);
  }, [jobs, selectedJob]);

  const roleGuide = useMemo(() => {
    const guideByArea = {
      software: {
        summary: "AI·소프트웨어 기능을 설계하고 구현하며, 사용자 문제를 실제 서비스로 바꾸는 직무입니다.",
        skills: ["프로그래밍 기초", "데이터·API 활용", "프로젝트 결과물 설명"],
        proof: ["작동하는 웹·앱 프로토타입", "GitHub 또는 개발 기록", "사용자 테스트와 개선 근거"],
      },
      electronics: {
        summary: "전기·전자 회로와 제어 기술을 이용해 제품과 설비가 안정적으로 동작하도록 만드는 직무입니다.",
        skills: ["전기·전자 기초", "회로 해석과 계측", "안전 규정과 문제 해결"],
        proof: ["회로도·배선도", "측정 및 고장 분석 기록", "관련 자격증과 제작 프로젝트"],
      },
      invent: {
        summary: "현장의 문제를 발견하고 해결 아이디어를 구체화해 제품·기술·지식재산으로 연결하는 직무입니다.",
        skills: ["문제 정의", "선행기술 비교", "아이디어 구조화와 발표"],
        proof: ["발명노트", "유사 기술 비교표", "프로토타입과 차별화 근거"],
      },
      project: {
        summary: "목표와 일정을 정리하고 팀의 역할과 결과를 연결해 프로젝트를 완성하는 직무입니다.",
        skills: ["일정·업무 관리", "협업과 의사소통", "성과 정리"],
        proof: ["프로젝트 계획서", "역할·기여 기록", "일지와 최종 성과"],
      },
      automation: {
        summary: "센서·제어기·로봇·설비를 연결해 생산과 작업 과정을 자동화하는 직무입니다.",
        skills: ["PLC·제어 기초", "센서·모터 활용", "공정 분석과 안전"],
        proof: ["자동화 동작 영상", "I/O·제어 흐름도", "테스트와 개선 일지"],
      },
    };
    return guideByArea[analysis.top?.key] || guideByArea.software;
  }, [analysis.top?.key]);

  return <main className="maker-page career-page">
    <section className="maker-page-head"><div><span>GROW</span><h1>진로 로드맵</h1><p>희망 직무를 정하고, 활동 근거와 다음 행동을 졸업 전까지 이어서 관리하세요.</p></div><button className="maker-ghost" onClick={() => onNavigate?.("opportunities")}>참여할 활동 찾기</button></section>
    <nav className="career-workspace-tabs" aria-label="진로 화면"><button className={tab === "roadmap" ? "active" : ""} onClick={() => setTab("roadmap")}>진로 로드맵</button><button className={tab === "record" ? "active" : ""} onClick={() => setTab("record")}>생기부 활동 정리</button></nav>

    {tab === "roadmap" && <>
    <section className="maker-card career-goal-editor">
      <header><div><span>MY CAREER GOAL</span><h2>희망 진로와 도달 시점</h2></div><small>입력한 목표는 아래 준비 단계와 연결됩니다.</small></header>
      <div><label>희망 직무<input value={careerProfile.targetRole || ""} onChange={(event) => updateCareer({ targetRole: event.target.value })} placeholder="예: 자동화설비 기술자"/></label><label>희망 기업·분야<input value={careerProfile.targetCompany || ""} onChange={(event) => updateCareer({ targetCompany: event.target.value })} placeholder="예: 반도체 장비·스마트팩토리"/></label><label>목표 시점<input type="date" value={careerProfile.targetDate || ""} onChange={(event) => updateCareer({ targetDate: event.target.value })}/></label></div>
    </section>

    <section className="maker-card personal-milestones">
      <header><div><span>STAR PROJECT ROADMAP</span><h2>활동을 역량 근거로 연결하기</h2><p>자격증·수업·프로젝트·대회를 ‘한 일 → 증거 → 배운 점’으로 남깁니다.</p></div></header>
      <div className="milestone-input-row"><select value={milestoneForm.phase} onChange={(event) => setMilestoneForm({ ...milestoneForm, phase: event.target.value })}><option>이번 달</option><option>이번 학기</option><option>졸업 전</option><option>입사 준비</option></select><input value={milestoneForm.title} onChange={(event) => setMilestoneForm({ ...milestoneForm, title: event.target.value })} placeholder="예: PLC 제어 미니 프로젝트 완성"/><input type="date" value={milestoneForm.deadline} onChange={(event) => setMilestoneForm({ ...milestoneForm, deadline: event.target.value })}/><input value={milestoneForm.evidence} onChange={(event) => setMilestoneForm({ ...milestoneForm, evidence: event.target.value })} placeholder="남길 증거: 영상, 회로도, 보고서"/><button className="primary" onClick={addMilestone}>단계 추가</button></div>
      <div className="personal-milestone-list">{roadmapMilestones.map((item) => <article key={item.id} className={item.done ? "done" : ""}><label><input type="checkbox" checked={Boolean(item.done)} onChange={(event) => patchMilestone(item.id, { done: event.target.checked })}/><span>{item.phase}</span></label><div><strong>{item.title}</strong><small>{item.deadline || "날짜 미정"} · {item.evidence || "증거를 정해 주세요"}</small></div><button onClick={() => updateCareer({ roadmapMilestones: roadmapMilestones.filter((entry) => entry.id !== item.id) })}>삭제</button></article>)}{!roadmapMilestones.length && <div className="maker-inline-empty compact"><strong>직접 정한 준비 단계가 아직 없습니다.</strong><p>이번 학기에 끝낼 한 가지부터 추가해 보세요.</p></div>}</div>
    </section>

    <section className="career-type-card maker-card">
      <div className="career-type-summary">
        <span>MAKER TYPE</span>
        <strong>{analysis.code}</strong>
        <h2>{analysis.typeName}</h2>
        <p>저장된 학습·발명·프로젝트 기록을 바탕으로 한 참고용 성장 분석입니다.</p>
        <div className="career-evidence-line">PDF {analysis.counts.pdfs} · 발명 {analysis.counts.inventions} · 프로젝트 {analysis.counts.projects} · 일지 {analysis.counts.journals}</div>
      </div>
      <div className="career-axis-list">{analysis.axes.map((axis) => <div key={`${axis.leftCode}${axis.rightCode}`}>
        <header><strong className={axis.selected === axis.leftCode ? "active" : ""}>{axis.leftCode} {axis.left}</strong><span>{axis.leftValue}% : {axis.rightValue}%</span><strong className={axis.selected === axis.rightCode ? "active" : ""}>{axis.right} {axis.rightCode}</strong></header>
        <i><b style={{ width: `${axis.leftValue}%` }} /></i>
      </div>)}</div>
    </section>

    <section className="career-hero maker-card">
      <div><span>성장 성향 분포</span><h2>{analysis.top?.name}</h2><p>활동이 쌓일수록 강점과 성장 방향이 더 선명하게 나타나요.</p></div>
      <div className="career-radar">{analysis.tendencies.map((skill) => <div key={skill.name}><span>{skill.name}</span><i><b style={{ width: `${skill.score}%` }} /></i><strong>{skill.score}%</strong></div>)}</div>
    </section>

    <section className="career-roadmap maker-card">
      <div className="career-roadmap-head"><span>PERSONAL ROADMAP</span><h2>다음 직무로 연결하는 3단계</h2><p>지금까지 만든 결과물을 바탕으로 다음 준비 단계를 제안합니다.</p></div>
      <div className="career-roadmap-list">{analysis.roadmap.map((item) => <article key={item.step}>
        <b>{item.step}</b><div><header><h3>{item.title}</h3><strong>{item.progress}%</strong></header><i><span style={{ width: `${item.progress}%` }} /></i><p>{item.detail}</p><small>다음 행동 · {item.action}</small></div>
      </article>)}</div>
    </section>

    <section className="career-grid career-job-grid">
      <article className="maker-card career-job-list"><span>연결 가능한 직무</span>{jobs.map((job) => <button key={job} className={selectedJob === job ? "active" : ""} onClick={() => setSelectedJob(job)} aria-pressed={selectedJob === job}><span>{job}<small>{analysis.top?.name} 활동과 연결</small></span><b>›</b></button>)}</article>
      <article className="maker-card career-job-detail"><span>직무 준비 가이드</span><h2>{selectedJob}</h2><p>{roleGuide.summary}</p><div className="career-job-detail-columns"><div><strong>필요 역량</strong><ul>{roleGuide.skills.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>포트폴리오 근거</strong><ul>{roleGuide.proof.map((item) => <li key={item}>{item}</li>)}</ul></div></div><div className="career-job-actions"><button className="secondary" onClick={() => onNavigate?.("catalog")}>관련 학습 찾기</button><button className="secondary" onClick={() => onNavigate?.("invent")}>아이디어 만들기</button><button className="primary" onClick={() => onNavigate?.("portfolio")}>이력서 근거 정리</button></div></article>
    </section>

    <section className="maker-card career-evidence-card"><span>분석에 사용된 실제 기록</span><ol><li>AI 노트 {analysis.counts.notes}개 · 개념카드 {analysis.counts.cards}개</li><li>완료 작업 {analysis.counts.completedTasks}개 · 프로젝트 일지 {analysis.counts.journals}개</li><li>자격증 {analysis.counts.certifications}개 · 수상 경력 {analysis.counts.awards}개</li></ol></section>
    </>}

    {tab === "record" && <section className="student-record-workspace">
      <article className="maker-card student-record-form"><header><span>FACT FIRST</span><h2>활동 사실 먼저 적기</h2><p>AI는 입력한 사실만 문장으로 정리하며 없는 성과나 평가를 만들지 않습니다.</p></header><label>기록 영역<select value={recordForm.section} onChange={(event) => setRecordForm({ ...recordForm, section: event.target.value })}><option>진로활동</option><option>자율활동</option><option>동아리활동</option><option>봉사활동</option><option>세부능력 및 특기사항</option></select></label><label>활동명<input value={recordForm.activity} onChange={(event) => setRecordForm({ ...recordForm, activity: event.target.value })} placeholder="예: PLC 기반 컨베이어 제어 프로젝트"/></label><label>내 역할<input value={recordForm.role} onChange={(event) => setRecordForm({ ...recordForm, role: event.target.value })} placeholder="예: 센서 배선과 제어 로직 담당"/></label><label>실제로 한 행동<textarea rows="4" value={recordForm.action} onChange={(event) => setRecordForm({ ...recordForm, action: event.target.value })} placeholder="관찰 가능한 행동을 구체적으로 적어 주세요."/></label><div className="student-record-two"><label>결과·증거<textarea rows="3" value={recordForm.result} onChange={(event) => setRecordForm({ ...recordForm, result: event.target.value })} placeholder="완성물, 측정값, 보고서, 발표 등"/></label><label>배운 점·다음 행동<textarea rows="3" value={`${recordForm.learning}${recordForm.nextStep ? `\n${recordForm.nextStep}` : ""}`} onChange={(event) => setRecordForm({ ...recordForm, learning: event.target.value, nextStep: "" })} placeholder="무엇을 이해했고 다음에 무엇을 개선할지"/></label></div>{recordError && <p className="maker-error">{recordError}</p>}<button className="primary" onClick={generateStudentRecord} disabled={recordBusy}>{recordBusy ? "사실을 확인하며 정리 중…" : "AI로 교사 전달용 초안 만들기"}</button></article>
      <article className="maker-card student-record-output"><header><span>REVIEW</span><h2>교사에게 전달할 활동 정리</h2><p>공식 학교생활기록부 문구는 담당 교사가 확인하고 작성합니다.</p></header><textarea rows="15" value={recordForm.draft || ""} onChange={(event) => setRecordForm({ ...recordForm, draft: event.target.value })} placeholder="왼쪽에 활동 사실을 입력하면 과장 없는 참고 초안을 제안합니다."/>{recordForm.missingFacts?.length > 0 && <aside><strong>더 있으면 좋은 근거</strong><ul>{recordForm.missingFacts.map((item) => <li key={item}>{item}</li>)}</ul></aside>}{recordForm.caution && <small>{recordForm.caution}</small>}<button className="secondary" onClick={saveStudentRecord} disabled={!recordForm.draft?.trim()}>내 기록에 저장</button></article>
      <section className="maker-card student-record-saved"><header><span>SAVED</span><h2>저장한 활동 기록</h2></header>{studentRecordDrafts.map((item) => <article key={item.id}><div><span>{item.section}</span><strong>{item.activity}</strong><p>{item.draft}</p></div><button onClick={() => updateCareer({ studentRecordDrafts: studentRecordDrafts.filter((entry) => entry.id !== item.id) })}>삭제</button></article>)}{!studentRecordDrafts.length && <div className="maker-inline-empty compact">저장한 활동 기록이 없습니다.</div>}</section>
    </section>}
  </main>;
}
