import React, { useState } from "react";
import { postJson } from "../utils/api";
import { searchSchools } from "../utils/schoolApi";

const SELF_SECTIONS = [["selfIntro", "자기소개"], ["strengths", "성격의 장단점"], ["motivation", "지원동기"], ["aspiration", "입사 후 포부"]];
const EMPTY = {
  award: { title: "", organization: "", result: "", date: "", description: "" },
  certification: { name: "", issuer: "", acquiredDate: "", credentialId: "" },
  activity: { type: "대외활동", title: "", organization: "", startDate: "", endDate: "", role: "", description: "" },
};
const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const text = (profile, key) => profile?.[key] || "";
const period = (start, end) => start && end ? `${start} ~ ${end}` : start || end || "";

function Field({ label, wide, children }) { return <label className={`invent-field ${wide ? "span-all" : ""}`}><span>{label}</span>{children}</label>; }

function PrintDocument({ profile, awards, certifications, activities }) {
  const education = Array.isArray(profile.education) ? profile.education : [];
  const selfPages = [SELF_SECTIONS.slice(0, 2), SELF_SECTIONS.slice(2)];
  return <section className="official-resume-print" aria-hidden="true">
    <article className="official-sheet resume-sheet"><h1>이 력 서</h1>
      <table><tbody><tr><th rowSpan="4" className="photo-cell">{profile.photo ? <img src={profile.photo} alt=""/> : "사진"}</th><th>성명</th><td>{profile.name}</td><th>생년월일</th><td>{profile.birthDate}</td></tr><tr><th>한자</th><td>{profile.hanjaName}</td><th>성별</th><td>{profile.gender}</td></tr><tr><th>주소</th><td colSpan="3">{profile.address}</td></tr><tr><th>연락처</th><td>{profile.phone}</td><th>이메일</th><td>{profile.email}</td></tr></tbody></table>
      <h2>학력사항</h2><table><thead><tr><th>기간</th><th>학교명</th><th>전공</th><th>졸업 구분</th></tr></thead><tbody>{education.length ? education.map((x) => <tr key={x.id}><td>{period(x.startDate, x.endDate)}</td><td>{x.school}</td><td>{x.major}</td><td>{x.status}</td></tr>) : <tr><td colSpan="4">&nbsp;</td></tr>}</tbody></table>
      <h2>자격사항</h2><table><thead><tr><th>자격증명</th><th>취득일</th><th>발급기관</th><th>자격번호</th></tr></thead><tbody>{certifications.length ? certifications.map((x) => <tr key={x.id}><td>{x.name}</td><td>{x.acquiredDate}</td><td>{x.issuer}</td><td>{x.credentialId}</td></tr>) : <tr><td colSpan="4">&nbsp;</td></tr>}</tbody></table>
      <h2>수상경력</h2><table><thead><tr><th>수상명</th><th>수상일</th><th>수여기관</th><th>결과</th></tr></thead><tbody>{awards.length ? awards.map((x) => <tr key={x.id}><td>{x.title}</td><td>{x.date}</td><td>{x.organization}</td><td>{x.result}</td></tr>) : <tr><td colSpan="4">&nbsp;</td></tr>}</tbody></table>
      <h2>교내외 활동</h2><table><thead><tr><th>기간</th><th>활동명</th><th>기관·역할</th><th>주요 내용</th></tr></thead><tbody>{activities.length ? activities.map((x) => <tr key={x.id}><td>{period(x.startDate, x.endDate)}</td><td>{x.title}</td><td>{[x.organization, x.role].filter(Boolean).join(" · ")}</td><td>{x.description}</td></tr>) : <tr><td colSpan="4">&nbsp;</td></tr>}</tbody></table>
      <p className="official-declaration">위 기재 사항은 사실과 다름없음을 확인합니다.</p><p className="official-sign">{profile.signatureDate || "　　　년　　월　　일"}<br/>작성자: {profile.name || "　　　　　　　　　"} (서명)</p><strong className="official-school">{profile.school || "학교명"}</strong>
    </article>
    {selfPages.map((sections, page) => <article className="official-sheet self-sheet" key={page}><h1>자 기 소 개 서</h1><header><span>지원 분야</span><strong>{profile.desiredRole}</strong><span>성명</span><strong>{profile.name}</strong></header>{sections.map(([key, label]) => <section key={key}><h2>{label}</h2><p>{profile[key]}</p></section>)}<p className="official-sign">{profile.signatureDate || "　　　년　　월　　일"}<br/>작성자: {profile.name || "　　　　　　　　　"} (서명)</p><strong className="official-school">{profile.school || "학교명"}</strong></article>)}
  </section>;
}

function List({ items, primaryKey, dateKey, onEdit, onDelete }) {
  return <section className="portfolio-record-list">{items.map((item) => <article className="maker-card portfolio-record-card" key={item.id}><header><div><span>{item[dateKey] || "날짜 미입력"}</span><h3>{item[primaryKey]}</h3><p>{item.organization || item.issuer || ""}</p></div><div><button onClick={() => onEdit(item)}>수정</button><button className="danger" onClick={() => onDelete(item.id)}>삭제</button></div></header></article>)}{!items.length && <div className="maker-card maker-inline-empty"><h3>아직 등록된 항목이 없습니다.</h3><p>왼쪽 입력란에서 추가해 주세요.</p></div>}</section>;
}

function RecordForm({ type, draft, setDraft, onSave }) {
  const configs = {
    certification: [["name","자격증명"],["issuer","발급기관"],["acquiredDate","취득일","date"],["credentialId","자격번호"]],
    award: [["title","수상명"],["organization","수여기관"],["result","수상 결과"],["date","수상일","date"],["description","설명","textarea"]],
    activity: [["type","구분","select"],["title","활동명"],["organization","기관"],["role","역할"],["startDate","시작일","date"],["endDate","종료일","date"],["description","주요 활동 및 성과","textarea"]],
  };
  return <section className="maker-card portfolio-editor-card"><header><div><span>{type.toUpperCase()}</span><h2>{draft.id ? "항목 수정" : "새 항목"}</h2></div></header><div className="portfolio-form-grid">{configs[type].map(([key,label,inputType]) => <Field label={label} wide={inputType === "textarea"} key={key}>{inputType === "textarea" ? <textarea rows="4" value={draft[key] || ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}/> : inputType === "select" ? <select value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}>{["대외활동","교내활동","교육","동아리","봉사","기타"].map((x) => <option key={x}>{x}</option>)}</select> : <input type={inputType || "text"} value={draft[key] || ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}/>}</Field>)}</div><button className="maker-primary maker-wide" onClick={onSave}>저장</button></section>;
}

export default function PortfolioPage({ buildProjects = [], resumeProfile = {}, onChangeResumeProfile, awards = [], onChangeAwards, certifications = [], onChangeCertifications, portfolioItems = [], onChangePortfolioItems, onNavigate }) {
  const [tab, setTab] = useState("resume");
  const [schoolQuery, setSchoolQuery] = useState(text(resumeProfile, "school")); const [schools, setSchools] = useState([]); const [schoolBusy, setSchoolBusy] = useState(false);
  const [draftType, setDraftType] = useState("certification"); const [draft, setDraft] = useState({ ...EMPTY.certification });
  const [aiSection, setAiSection] = useState("selfIntro"); const [aiMode, setAiMode] = useState("draft"); const [aiBusy, setAiBusy] = useState(false); const [aiResult, setAiResult] = useState(null);
  const education = Array.isArray(resumeProfile.education) ? resumeProfile.education : [];
  const update = (patch) => onChangeResumeProfile({ ...resumeProfile, ...patch });

  async function findSchool() { if (schoolQuery.trim().length < 2) return alert("학교 이름을 두 글자 이상 입력해 주세요."); setSchoolBusy(true); try { setSchools((await searchSchools(schoolQuery.trim())).schools || []); } catch (e) { alert(e.message); } finally { setSchoolBusy(false); } }
  function loadPhoto(event) { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) return alert("이미지 파일을 선택해 주세요."); if (file.size > 2 * 1024 * 1024) return alert("사진은 2MB 이하만 사용할 수 있습니다."); const reader = new FileReader(); reader.onload = () => update({ photo: String(reader.result || "") }); reader.readAsDataURL(file); }
  function selectType(type) { setDraftType(type); setDraft({ ...EMPTY[type] }); }
  function storeRecord() {
    const maps = { certification: [certifications,onChangeCertifications,"name"], award: [awards,onChangeAwards,"title"], activity: [portfolioItems,onChangePortfolioItems,"title"] };
    const [items,setter,required] = maps[draftType]; if (!String(draft[required] || "").trim()) return alert(`${required === "name" ? "자격증명" : "항목명"}을 입력해 주세요.`);
    const item = { ...draft, id: draft.id || id(draftType) }; setter(items.some((x) => x.id === item.id) ? items.map((x) => x.id === item.id ? item : x) : [item, ...items]); setDraft({ ...EMPTY[draftType] });
  }
  async function askAi() { setAiBusy(true); setAiResult(null); try { setAiResult(await postJson("/api/resume/assist", { section: aiSection, mode: aiMode, currentText: text(resumeProfile, aiSection), desiredRole: text(resumeProfile,"desiredRole"), targetCompany: text(resumeProfile,"targetCompany"), profile: { school: text(resumeProfile,"school"), major: text(resumeProfile,"major") }, evidence: { projects: buildProjects.slice(0,8), awards: awards.slice(0,8), certifications: certifications.slice(0,8), activities: portfolioItems.slice(0,8) } }, "자소서 작성을 돕지 못했습니다.")); } catch (e) { setAiResult({ error: e.message }); } finally { setAiBusy(false); } }
  const recordMap = { certification: { items: certifications, setter: onChangeCertifications, primary: "name", date: "acquiredDate" }, award: { items: awards, setter: onChangeAwards, primary: "title", date: "date" }, activity: { items: portfolioItems, setter: onChangePortfolioItems, primary: "title", date: "startDate" } };
  const currentRecord = recordMap[draftType];

  return <main className="maker-page portfolio-page portfolio-resume-page">
    <section className="maker-page-head portfolio-page-head"><div><span>RESUME STUDIO</span><h1>이력서 · 자기소개서</h1><p>기본 정보와 경험을 입력하면 학교 제출 양식으로 바로 인쇄할 수 있습니다.</p></div><button className="maker-primary" onClick={() => window.print()}>PDF로 저장·인쇄</button></section>
    <nav className="portfolio-tabs">{[["resume","이력서 작성"],["self","자기소개서"],["ai","AI 작성 도움"],["records","경력 자료"]].map(([key,label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}<button onClick={() => onNavigate?.("opportunities")}>공모전·대외활동 찾기</button></nav>
    {tab === "resume" && <div className="resume-workspace"><section className="maker-card portfolio-editor-card"><header><div><span>BASIC INFORMATION</span><h2>기본 정보</h2><p>예시 데이터 없이 직접 입력한 내용만 저장됩니다.</p></div></header><div className="portfolio-form-grid">
      <Field label="증명사진"><div className="resume-photo-input">{resumeProfile.photo && <img src={resumeProfile.photo} alt="등록한 증명사진"/>}<input type="file" accept="image/*" onChange={loadPhoto}/>{resumeProfile.photo && <button type="button" onClick={() => update({ photo: "" })}>삭제</button>}</div></Field>
      {[["name","성명"],["hanjaName","한자 성명"],["birthDate","생년월일","date"],["address","주소"],["phone","연락처"],["email","이메일","email"],["desiredRole","희망 직무"],["targetCompany","지원 기업"],["signatureDate","작성일","date"]].map(([key,label,type]) => <Field label={label} wide={key === "address"} key={key}><input type={type || "text"} value={text(resumeProfile,key)} onChange={(e) => update({ [key]: e.target.value })}/></Field>)}
      <Field label="성별"><select value={text(resumeProfile,"gender")} onChange={(e) => update({ gender: e.target.value })}><option value="">선택 안 함</option><option>남</option><option>여</option><option>기재하지 않음</option></select></Field>
    </div></section>
    <section className="maker-card portfolio-editor-card"><header><div><span>SCHOOL</span><h2>학교 선택</h2><p>검색으로 선택하거나 학교명을 직접 수정할 수 있습니다.</p></div></header><div className="school-resume-search"><input value={schoolQuery} onChange={(e) => { setSchoolQuery(e.target.value); update({ school: e.target.value }); }} onKeyDown={(e) => e.key === "Enter" && findSchool()} placeholder="학교 이름 입력"/><button className="maker-primary" onClick={findSchool} disabled={schoolBusy}>{schoolBusy ? "검색 중…" : "학교 검색"}</button></div>{schools.length > 0 && <div className="school-search-results">{schools.map((school) => <button key={`${school.officeCode}:${school.schoolCode}`} onClick={() => { setSchoolQuery(school.schoolName); update({ school: school.schoolName }); setSchools([]); }}><strong>{school.schoolName}</strong><span>{school.region} · {school.schoolKind}</span></button>)}</div>}<div className="portfolio-form-grid resume-school-meta"><Field label="전공"><input value={text(resumeProfile,"major")} onChange={(e) => update({ major: e.target.value })}/></Field><Field label="학년"><input value={text(resumeProfile,"grade")} onChange={(e) => update({ grade: e.target.value })}/></Field></div></section>
    <section className="maker-card portfolio-editor-card"><header><div><span>EDUCATION</span><h2>학력사항</h2></div><button className="maker-ghost" onClick={() => update({ education: [...education,{ id:id("edu"), startDate:"",endDate:"",school:"",major:"",status:"졸업예정" }] })}>+ 학력 추가</button></header><div className="resume-row-list">{education.map((item) => <article key={item.id}>{[["startDate","date","입학일"],["endDate","date","졸업일"],["school","text","학교명"],["major","text","전공"]].map(([key,type,label]) => <input key={key} type={type} aria-label={label} placeholder={label} value={item[key]} onChange={(e) => update({ education: education.map((x) => x.id === item.id ? { ...x,[key]:e.target.value } : x) })}/>)}<select value={item.status} onChange={(e) => update({ education: education.map((x) => x.id === item.id ? { ...x,status:e.target.value } : x) })}><option>재학</option><option>졸업예정</option><option>졸업</option></select><button className="maker-danger-ghost" onClick={() => update({ education: education.filter((x) => x.id !== item.id) })}>삭제</button></article>)}{!education.length && <div className="maker-inline-empty"><h3>학력사항을 추가해 주세요</h3><p>기간과 학교명을 입력하면 인쇄 양식에 반영됩니다.</p></div>}</div></section></div>}
    {tab === "self" && <section className="self-intro-editor-grid">{SELF_SECTIONS.map(([key,label]) => <article className="maker-card portfolio-editor-card" key={key}><header><div><span>SELF INTRODUCTION</span><h2>{label}</h2></div><small>{text(resumeProfile,key).length}자</small></header><textarea rows="12" value={text(resumeProfile,key)} onChange={(e) => update({ [key]: e.target.value })} placeholder={`${label} 내용을 작성하세요.`}/></article>)}</section>}
    {tab === "ai" && <section className="maker-card resume-ai-studio"><div className="resume-ai-settings"><span>AI WRITING COACH</span><h2>내 경험으로 자소서 쓰기</h2><p>입력한 이력만 사용해 제안합니다. 확인 후 원하는 문항에 적용하세요.</p><Field label="문항"><select value={aiSection} onChange={(e) => { setAiSection(e.target.value); setAiResult(null); }}>{SELF_SECTIONS.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="도움 방식"><select value={aiMode} onChange={(e) => setAiMode(e.target.value)}><option value="draft">초안 만들기</option><option value="improve">현재 글 다듬기</option><option value="shorten">간결하게 줄이기</option></select></Field><button className="maker-primary maker-wide" disabled={aiBusy} onClick={askAi}>{aiBusy ? "경험을 정리하는 중…" : "AI에게 제안 받기"}</button></div><div className="resume-ai-output">{aiResult?.error ? <p className="maker-error">{aiResult.error}</p> : aiResult ? <><span>AI 제안</span><textarea rows="15" readOnly value={aiResult.draft || ""}/>{aiResult.note && <p>{aiResult.note}</p>}{aiResult.questions?.length > 0 && <aside><strong>더 좋아지려면</strong>{aiResult.questions.map((q) => <p key={q}>· {q}</p>)}</aside>}<button className="maker-primary" disabled={!aiResult.draft} onClick={() => { update({ [aiSection]:aiResult.draft }); setTab("self"); }}>이 문항에 적용</button></> : <div className="maker-inline-empty"><h3>문항을 선택해 시작하세요</h3><p>프로젝트, 자격증, 수상, 활동 기록이 많을수록 구체적으로 제안합니다.</p></div>}</div></section>}
    {tab === "records" && <><nav className="record-type-tabs">{[["certification",`자격증 ${certifications.length}`],["award",`수상 ${awards.length}`],["activity",`교내외 활동 ${portfolioItems.length}`]].map(([key,label]) => <button key={key} className={draftType === key ? "active" : ""} onClick={() => selectType(key)}>{label}</button>)}</nav><section className="portfolio-management-layout"><RecordForm type={draftType} draft={draft} setDraft={setDraft} onSave={storeRecord}/><List items={currentRecord.items} primaryKey={currentRecord.primary} dateKey={currentRecord.date} onEdit={setDraft} onDelete={(itemId) => currentRecord.setter(currentRecord.items.filter((x) => x.id !== itemId))}/></section></>}
    <PrintDocument profile={resumeProfile} awards={awards} certifications={certifications} activities={portfolioItems}/>
  </main>;
}
