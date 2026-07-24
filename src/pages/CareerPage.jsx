import React, { useEffect, useMemo, useState } from "react";

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
    <section className="maker-page-head"><div><span>GROW</span><h1>진로 로드맵</h1><p>각 역량을 따로 100점으로 표시하지 않고, 현재 활동 전체를 100%로 나누어 성장 성향을 보여줍니다.</p></div></section>

    <section className="career-type-card maker-card">
      <div className="career-type-summary">
        <span>MAKER TYPE</span>
        <strong>{analysis.code}</strong>
        <h2>{analysis.typeName}</h2>
        <p>MakerOS에 실제로 저장된 학습·발명·프로젝트 기록을 바탕으로 만든 탐색용 성향입니다. 적성검사나 채용 평가 점수가 아닙니다.</p>
        <div className="career-evidence-line">PDF {analysis.counts.pdfs} · 발명 {analysis.counts.inventions} · 프로젝트 {analysis.counts.projects} · 일지 {analysis.counts.journals}</div>
      </div>
      <div className="career-axis-list">{analysis.axes.map((axis) => <div key={`${axis.leftCode}${axis.rightCode}`}>
        <header><strong className={axis.selected === axis.leftCode ? "active" : ""}>{axis.leftCode} {axis.left}</strong><span>{axis.leftValue}% : {axis.rightValue}%</span><strong className={axis.selected === axis.rightCode ? "active" : ""}>{axis.right} {axis.rightCode}</strong></header>
        <i><b style={{ width: `${axis.leftValue}%` }} /></i>
      </div>)}</div>
    </section>

    <section className="career-hero maker-card">
      <div><span>성장 성향 분포</span><h2>{analysis.top?.name}</h2><p>아래 다섯 영역의 합은 항상 100%입니다. 활동이 적을 때는 작은 차이만 표시하고, 기록이 늘어날수록 실제 성향이 더 뚜렷해집니다.</p></div>
      <div className="career-radar">{analysis.tendencies.map((skill) => <div key={skill.name}><span>{skill.name}</span><i><b style={{ width: `${skill.score}%` }} /></i><strong>{skill.score}%</strong></div>)}</div>
    </section>

    <section className="career-roadmap maker-card">
      <div className="career-roadmap-head"><span>PERSONAL ROADMAP</span><h2>다음 직무로 연결하는 3단계</h2><p>진행률은 실제 저장된 자료·완료 작업·일지·자격증·수상 기록만 반영합니다.</p></div>
      <div className="career-roadmap-list">{analysis.roadmap.map((item) => <article key={item.step}>
        <b>{item.step}</b><div><header><h3>{item.title}</h3><strong>{item.progress}%</strong></header><i><span style={{ width: `${item.progress}%` }} /></i><p>{item.detail}</p><small>다음 행동 · {item.action}</small></div>
      </article>)}</div>
    </section>

    <section className="career-grid career-job-grid">
      <article className="maker-card career-job-list"><span>연결 가능한 직무</span>{jobs.map((job) => <button key={job} className={selectedJob === job ? "active" : ""} onClick={() => setSelectedJob(job)} aria-pressed={selectedJob === job}><span>{job}<small>{analysis.top?.name} 활동과 연결</small></span><b>›</b></button>)}</article>
      <article className="maker-card career-job-detail"><span>직무 준비 가이드</span><h2>{selectedJob}</h2><p>{roleGuide.summary}</p><div className="career-job-detail-columns"><div><strong>필요 역량</strong><ul>{roleGuide.skills.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>포트폴리오 근거</strong><ul>{roleGuide.proof.map((item) => <li key={item}>{item}</li>)}</ul></div></div><div className="career-job-actions"><button className="secondary" onClick={() => onNavigate?.("catalog")}>관련 학습 찾기</button><button className="secondary" onClick={() => onNavigate?.("invent")}>아이디어 만들기</button><button className="primary" onClick={() => onNavigate?.("portfolio")}>이력서 근거 정리</button></div></article>
    </section>

    <section className="maker-card career-evidence-card"><span>분석에 사용된 실제 기록</span><ol><li>AI 노트 {analysis.counts.notes}개 · 단어카드 {analysis.counts.cards}개</li><li>완료 작업 {analysis.counts.completedTasks}개 · 프로젝트 일지 {analysis.counts.journals}개</li><li>자격증 {analysis.counts.certifications}개 · 수상 경력 {analysis.counts.awards}개</li></ol></section>
  </main>;
}
