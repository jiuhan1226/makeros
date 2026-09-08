import { useEffect, useState } from "react";

const TUTORIAL_KEY = "makeros:tutorial-completed:v1";
const steps = [
  { title: "목표부터 간단히 입력", text: "목표 이름과 날짜, 공부 가능한 시간만 입력하세요. 첫 계획 만들기를 누르면 목표 화면부터 안내합니다.", target: "partnerGoals", action: "목표 입력하기" },
  { title: "AI가 날짜에서 역산", text: "입력한 가장 늦은 목표일까지 필요한 기간을 계산하고, 가능한 시간 안에서 주간·오늘 분량을 나눕니다.", target: "partnerPlan", action: "계획 보기" },
  { title: "캘린더에서 바로 추가", text: "날짜를 누르면 기간 일정을 바로 만들 수 있습니다. 하루짜리 일정은 체크박스만 선택하세요.", target: "partnerCalendar", action: "캘린더 열기" },
  { title: "자격증과 내신 학습", text: "자격증에서는 CBT 과목을 골라 풀고, 내신에서는 PDF로 AI 노트·개념카드·퀴즈를 만들 수 있습니다.", target: "catalog", action: "학습 시작" },
  { title: "AI는 비회원도 체험", text: "로그인 전에는 각 AI 기능을 하루 2회 체험할 수 있습니다. 로그인하면 저장·동기화와 전체 이용 한도가 적용됩니다.", target: "partnerToday", action: "시작하기" },
];

export function shouldShowTutorial() {
  try { return localStorage.getItem(TUTORIAL_KEY) !== "done"; }
  catch { return true; }
}

export default function TutorialModal({ open, onClose, onNavigate }) {
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  if (!open) return null;
  const current = steps[step];
  const finish = (navigate = false) => {
    try { localStorage.setItem(TUTORIAL_KEY, "done"); } catch { /* 저장 불가 시 이번 세션만 닫습니다. */ }
    onClose?.();
    if (navigate) onNavigate?.(current.target);
  };
  return <div className="modal-backdrop tutorial-backdrop">
    <section className="modal makeros-tutorial" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <button className="modal-close" onClick={() => finish(false)} aria-label="튜토리얼 닫기">×</button>
      <div className="tutorial-progress" aria-label={`${step + 1}/${steps.length} 단계`}>{steps.map((_, index) => <i className={index <= step ? "active" : ""} key={index}/>)}</div>
      <span className="partner-kicker">처음 사용 가이드 · {step + 1}/{steps.length}</span>
      <h2 id="tutorial-title">{current.title}</h2>
      <p>{current.text}</p>
      <div className="tutorial-actions">
        {step > 0 && <button className="secondary" onClick={() => setStep((value) => value - 1)}>이전</button>}
        <button className="text-button" onClick={() => finish(true)}>{current.action}</button>
        {step < steps.length - 1
          ? <button className="primary" onClick={() => setStep((value) => value + 1)}>다음</button>
          : <button className="primary" onClick={() => finish(true)}>MakerOS 시작</button>}
      </div>
    </section>
  </div>;
}
