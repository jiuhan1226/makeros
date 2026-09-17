import { useEffect, useState } from "react";

const TUTORIAL_KEY = "makeros:tutorial-completed:v2";
const steps = [
  { title: "목표부터 간단히 입력", text: "목표 이름과 준비 기간, 공부 가능한 시간만 입력하세요. AI가 남은 기간에 맞춰 계획을 나눕니다." },
  { title: "오늘은 추천된 일부터", text: "오늘 탭에는 먼저 할 일 두 개만 보입니다. 나머지는 접어 두고 필요한 순간에만 확인할 수 있습니다." },
  { title: "자격증과 내신을 바로 학습", text: "자격증은 해당 종목 CBT로, 내신은 업로드한 PDF 학습으로 바로 이어집니다." },
  { title: "결과를 보고 계획 확정", text: "학습 결과로 계획이 바뀌면 차이를 먼저 보여 줍니다. 확인한 뒤 새 계획을 적용하거나 기존 계획을 유지하세요." },
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
