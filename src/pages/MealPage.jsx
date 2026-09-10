import { useEffect, useMemo, useState } from "react";
import { normalizePartnerState } from "../utils/aiPartner";
import { loadSchoolMeals } from "../utils/schoolApi";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function compactDate(value) {
  return String(value || "").replace(/-/g, "");
}

function weekDays(cursor) {
  const base = new Date(cursor); base.setHours(12, 0, 0, 0);
  const monday = new Date(base); monday.setDate(base.getDate() + (base.getDay() === 0 ? -6 : 1 - base.getDay()));
  return Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return date; });
}

function displayDish(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(.*?)\s*(\([\d.]+\))\s*$/);
  return { name: (match?.[1] || text).trim(), allergens: match?.[2] || "" };
}

export default function MealPage({ state, onNavigate }) {
  const normalized = useMemo(() => normalizePartnerState(state), [state]);
  const school = normalized.timetable;
  const [cursor, setCursor] = useState(() => new Date());
  const days = useMemo(() => weekDays(cursor), [cursor]);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [meals, setMeals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rangeKey = `${isoDate(days[0])}:${isoDate(days[6])}:${school.schoolCode}`;

  useEffect(() => { if (school.officeCode && school.schoolCode) refreshMeals(); }, [rangeKey]);

  async function refreshMeals() {
    setBusy(true); setError("");
    try {
      const result = await loadSchoolMeals({ officeCode: school.officeCode, schoolCode: school.schoolCode, from: isoDate(days[0]), to: isoDate(days[6]) });
      setMeals(result.meals || []);
      if (!result.meals?.length) setError("선택한 주의 급식 정보가 없습니다.");
    } catch (requestError) { setError(requestError.message); setMeals([]); }
    finally { setBusy(false); }
  }

  function moveWeek(amount) {
    setCursor((current) => { const next = new Date(current); next.setDate(next.getDate() + amount * 7); return next; });
    const next = new Date(days[0]); next.setDate(next.getDate() + amount * 7); setSelectedDate(isoDate(next));
  }

  const selectedMeals = meals.filter((meal) => meal.date === compactDate(selectedDate));

  return <main className="partner-page meal-page">
    <nav className="school-life-tabs" aria-label="학교 생활 메뉴"><button onClick={() => onNavigate("partnerCalendar")}>월간 일정</button><button onClick={() => onNavigate("timetable")}>학교 시간표</button><button className="active">급식</button></nav>
    <section className="partner-page-head"><div><span className="partner-kicker">LIVE SCHOOL MEALS</span><h1>학교 급식</h1><p>나이스 교육정보에서 {school.schoolName}의 급식을 실시간으로 확인합니다.</p></div><div className="meal-head-actions"><button className="partner-secondary" onClick={() => onNavigate("timetable")}>학교 바꾸기</button><button className="partner-secondary" onClick={refreshMeals} disabled={busy}>{busy ? "불러오는 중…" : "새로고침"}</button></div></section>

    <section className="partner-panel meal-week-panel">
      <header><button onClick={() => moveWeek(-1)} aria-label="이전 주">‹</button><div><strong>{isoDate(days[0])} ~ {isoDate(days[6])}</strong><small>{school.schoolName} · 나이스 교육정보</small></div><button onClick={() => moveWeek(1)} aria-label="다음 주">›</button></header>
      <nav>{days.map((date) => { const value = isoDate(date); return <button key={value} className={selectedDate === value ? "active" : ""} onClick={() => setSelectedDate(value)}><span>{DAY_LABELS[date.getDay()]}</span><strong>{date.getDate()}</strong><i>{meals.filter((meal) => meal.date === compactDate(value)).length || ""}</i></button>; })}</nav>
    </section>

    {error && <p className="school-api-error" role="alert">{error}</p>}
    <section className="meal-card-grid">
      {selectedMeals.map((meal) => <article className="partner-panel meal-card" key={`${meal.date}:${meal.type}`}><header><span>{meal.type}</span><strong>{meal.calories || "열량 정보 없음"}</strong></header><ul>{meal.dishes.map((dish, index) => { const display = displayDish(dish); return <li key={`${dish}:${index}`}><span>{display.name}</span>{display.allergens && <small>{display.allergens}</small>}</li>; })}</ul><details><summary>영양·원산지 정보</summary><div><strong>영양정보</strong>{meal.nutrition.map((item) => <span key={item}>{item}</span>)}<strong>원산지</strong><p>{meal.origin}</p></div></details></article>)}
      {!busy && !selectedMeals.length && <div className="partner-panel meal-empty"><strong>이 날짜에는 등록된 급식이 없습니다.</strong><p>주말·공휴일이거나 학교에서 아직 정보를 등록하지 않았을 수 있습니다.</p></div>}
      {busy && <div className="partner-panel meal-empty"><strong>급식 정보를 불러오고 있어요.</strong><p>잠시만 기다려 주세요.</p></div>}
    </section>
    <p className="meal-allergy-note">메뉴의 괄호 속 숫자는 식품 알레르기 정보이며, 상세 내용은 학교 안내를 함께 확인해 주세요.</p>
  </main>;
}
