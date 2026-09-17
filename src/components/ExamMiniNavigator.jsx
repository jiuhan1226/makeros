import { useEffect, useRef, useState } from "react";
import { CBT_MINI_POSITION_KEY } from "../utils/cbtPreferences";

const DIMENSIONS = {
  compact: { width: 148, height: 74 },
  normal: { width: 176, height: 86 },
  large: { width: 214, height: 102 },
};

function initialPosition(size) {
  const dimensions = DIMENSIONS[size] || DIMENSIONS.normal;
  const fallback = { x: 24, y: Math.max(16, window.innerHeight - dimensions.height - 96) };
  try {
    const stored = JSON.parse(localStorage.getItem(CBT_MINI_POSITION_KEY) || "null");
    return stored && Number.isFinite(stored.x) && Number.isFinite(stored.y) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function clampPosition(position, size) {
  const dimensions = DIMENSIONS[size] || DIMENSIONS.normal;
  return {
    x: Math.max(8, Math.min(window.innerWidth - dimensions.width - 8, position.x)),
    y: Math.max(8, Math.min(window.innerHeight - dimensions.height - 8, position.y)),
  };
}

export default function ExamMiniNavigator({ current, total, size, onPrevious, onNext, onHide, onOpenSettings }) {
  const [position, setPosition] = useState(() => initialPosition(size));
  const drag = useRef(null);

  useEffect(() => {
    function fit() {
      setPosition((previous) => clampPosition(previous, size));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [size]);

  useEffect(() => {
    try { localStorage.setItem(CBT_MINI_POSITION_KEY, JSON.stringify(position)); } catch { /* no-op */ }
  }, [position]);

  function startDrag(event) {
    if (event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, dx: event.clientX - position.x, dy: event.clientY - position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragMove(event) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    setPosition(clampPosition({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy }, size));
  }

  function endDrag(event) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  return (
    <aside className={`exam-mini-navigator size-${size}`} style={{ left: position.x, top: position.y }} aria-label="미니 문제 이동">
      <div className="exam-mini-drag" onPointerDown={startDrag} onPointerMove={dragMove} onPointerUp={endDrag} onPointerCancel={endDrag} title="드래그해서 이동">
        <span aria-hidden="true">⠿</span>
        <b>{current + 1} / {total}</b>
        <div>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onOpenSettings} aria-label="CBT 설정 열기">⚙</button>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onHide} aria-label="미니 방향키 숨기기">×</button>
        </div>
      </div>
      <div className="exam-mini-actions">
        <button type="button" onClick={onPrevious} disabled={current === 0} aria-label="이전 문제">←</button>
        <button type="button" onClick={onNext} disabled={current >= total - 1} aria-label="다음 문제">→</button>
      </div>
    </aside>
  );
}
