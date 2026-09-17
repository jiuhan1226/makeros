import { useEffect } from "react";
import { DEFAULT_CBT_SETTINGS, normalizeCbtSettings } from "../utils/cbtPreferences";

const SIZE_OPTIONS = [
  { id: "compact", label: "작게" },
  { id: "normal", label: "보통" },
  { id: "large", label: "크게" },
];

const LAYOUT_OPTIONS = [
  { id: "auto", label: "자동", description: "화면 폭에 맞춰 자동 배치" },
  { id: "split", label: "좌우 배치", description: "문제와 답안지를 함께 표시" },
  { id: "focus", label: "문제 집중", description: "문제 영역을 넓게 표시" },
];

export default function CbtSettingsPanel({ open, settings, onChange, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  function update(patch) {
    onChange(normalizeCbtSettings({ ...settings, ...patch }));
  }

  return (
    <div className="cbt-settings-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="cbt-settings-panel" role="dialog" aria-modal="true" aria-labelledby="cbt-settings-title">
        <header>
          <div>
            <span>CBT 환경 설정</span>
            <h2 id="cbt-settings-title">내 화면에 맞게 조정</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="설정 닫기">×</button>
        </header>

        <div className="cbt-settings-body">
          <section>
            <div className="cbt-setting-heading">
              <strong>이동 방법</strong>
              <small>설정은 다음 시험에도 유지됩니다.</small>
            </div>
            <label className="cbt-setting-toggle">
              <span><b>키보드 방향키</b><small>← 이전 문제 · → 다음 문제</small></span>
              <input type="checkbox" checked={settings.keyboardNavigation} onChange={(event) => update({ keyboardNavigation: event.target.checked })} />
              <i aria-hidden="true" />
            </label>
            <label className="cbt-setting-toggle">
              <span><b>미니 방향키</b><small>화면에서 원하는 위치로 드래그</small></span>
              <input type="checkbox" checked={settings.miniNavigator} onChange={(event) => update({ miniNavigator: event.target.checked })} />
              <i aria-hidden="true" />
            </label>
            <fieldset disabled={!settings.miniNavigator}>
              <legend>미니 방향키 크기</legend>
              <div className="cbt-segmented">
                {SIZE_OPTIONS.map((option) => <button type="button" key={option.id} className={settings.navigatorSize === option.id ? "active" : ""} onClick={() => update({ navigatorSize: option.id })}>{option.label}</button>)}
              </div>
            </fieldset>
          </section>

          <section>
            <div className="cbt-setting-heading"><strong>화면 배치</strong><small>필요한 정보만 남길 수 있어요.</small></div>
            <div className="cbt-layout-options">
              {LAYOUT_OPTIONS.map((option) => (
                <button type="button" key={option.id} className={settings.layout === option.id ? "active" : ""} onClick={() => update({ layout: option.id, ...(option.id !== "focus" ? {} : { answerSheet: "hidden" }) })}>
                  <b>{option.label}</b><small>{option.description}</small>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="cbt-setting-heading"><strong>화면 크기</strong><small>문제 글자와 여백을 함께 조절합니다.</small></div>
            <div className="cbt-segmented">
              {SIZE_OPTIONS.map((option) => <button type="button" key={option.id} className={settings.contentScale === option.id ? "active" : ""} onClick={() => update({ contentScale: option.id })}>{option.label}</button>)}
            </div>
          </section>

          <section>
            <div className="cbt-setting-heading"><strong>답안지</strong><small>숨겨도 답안은 그대로 저장됩니다.</small></div>
            <div className="cbt-segmented two">
              <button type="button" className={settings.answerSheet === "visible" ? "active" : ""} onClick={() => update({ answerSheet: "visible", ...(settings.layout === "focus" ? { layout: "auto" } : {}) })}>계속 보임</button>
              <button type="button" className={settings.answerSheet === "hidden" ? "active" : ""} onClick={() => update({ answerSheet: "hidden" })}>숨기기</button>
            </div>
          </section>
        </div>

        <footer>
          <button type="button" className="secondary" onClick={() => onChange({ ...DEFAULT_CBT_SETTINGS })}>기본값 복원</button>
          <button type="button" className="primary" onClick={onClose}>설정 완료</button>
        </footer>
      </section>
    </div>
  );
}
