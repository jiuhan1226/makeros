import { useEffect, useState } from "react";

const TUTORIAL_KEY = "makeros:tutorial-completed:v2";
const steps = [
  { title: "목표부터 간단히 입력", text: "목표 이름과 준비 기간, 공부 가능한 시간만 입력하세요. AI가 남은 기간에 맞춰 계획을 나눕니다." },
  { title: "자격증과 내신 계획 확인", text: "계획 탭 위의 자격증·내신 버튼을 누르면 필요한 계획만 따로 확인할 수 있습니다." },
  { title: "캘린더에서 바로 추가", text: "날짜를 누르면 기간 일정을 바로 만들 수 있습니다. 하루짜리 일정은 체크박스를 선택하세요." },
  { title: "자격증은 CBT로 학습", text: "일정에 등록한 자격증의 CBT 시작 버튼을 누르면 해당 종목 문제로 바로 연결됩니다." },
  { title: "내신은 PDF부터 업로드", text: "내신 탭에서 새 PDF 업로드를 누르고 교과서나 학습 자료를 선택하세요. 업로드 후 AI 노트·개념카드·퀴즈를 만들 수 있습니다." },
  { title: "AI는 비회원도 체험", text: "로그인 전에는 AI 기능을 제한 횟수만큼 체험할 수 있습니다. 로그인하면 학습 기록을 저장하고 이어서 사용할 수 있습니다." },
];

export function shouldShowTutorial() {
  try { return localStorage.getItem(TUTORIAL_KEY) !== "done"; }
  catch { return true; }
}

export default function TutorialModal({ open, onClose }) {
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  if (!open) return null;
  const current = steps[step];
  const finish = () => {
    try { localStorage.setItem(TUTORIAL_KEY, "done"); } catch { /* 저장 불가 시 이번 세션만 닫습니다. */ }
    onClose?.();
  };
  return <div className="modal-backdrop tutorial-backdrop">
    <section className="modal makeros-tutorial" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <button className="modal-close" onClick={finish} aria-label="튜토리얼 닫기">×</button>
      <div className="tutorial-progress" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }} aria-label={`${step + 1}/${steps.length} 단계`}>{steps.map((_, index) => <i className={index <= step ? "active" : ""} key={index}/>)}</div>
      <span className="partner-kicker">처음 사용 가이드 · {step + 1}/{steps.length}</span>
      <h2 id="tutorial-title">{current.title}</h2>
      <p>{current.text}</p>
      <div className="tutorial-actions">
        {step > 0 && <button className="secondary" onClick={() => setStep((value) => value - 1)}>이전</button>}
        {step < steps.length - 1
          ? <button className="primary" onClick={() => setStep((value) => value + 1)}>다음</button>
          : <button className="primary" onClick={finish}>MakerOS 시작</button>}
      </div>
    </section>
  </div>;
}
