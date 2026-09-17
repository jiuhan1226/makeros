export const CBT_SETTINGS_KEY = "makeros-cbt-settings-v1";
export const CBT_MINI_POSITION_KEY = "makeros-cbt-mini-position-v1";

export const DEFAULT_CBT_SETTINGS = Object.freeze({
  keyboardNavigation: true,
  miniNavigator: true,
  navigatorSize: "normal",
  layout: "auto",
  contentScale: "normal",
  answerSheet: "visible",
});

const ALLOWED = {
  navigatorSize: ["compact", "normal", "large"],
  layout: ["auto", "split", "focus"],
  contentScale: ["compact", "normal", "large"],
  answerSheet: ["visible", "hidden"],
};

export function normalizeCbtSettings(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const next = {
    keyboardNavigation: input.keyboardNavigation !== false,
    miniNavigator: input.miniNavigator !== false,
    navigatorSize: ALLOWED.navigatorSize.includes(input.navigatorSize) ? input.navigatorSize : DEFAULT_CBT_SETTINGS.navigatorSize,
    layout: ALLOWED.layout.includes(input.layout) ? input.layout : DEFAULT_CBT_SETTINGS.layout,
    contentScale: ALLOWED.contentScale.includes(input.contentScale) ? input.contentScale : DEFAULT_CBT_SETTINGS.contentScale,
    answerSheet: ALLOWED.answerSheet.includes(input.answerSheet) ? input.answerSheet : DEFAULT_CBT_SETTINGS.answerSheet,
  };
  if (next.layout === "focus") next.answerSheet = "hidden";
  return next;
}

export function readCbtSettings(storage = globalThis?.localStorage) {
  if (!storage) return { ...DEFAULT_CBT_SETTINGS };
  try {
    return normalizeCbtSettings(JSON.parse(storage.getItem(CBT_SETTINGS_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_CBT_SETTINGS };
  }
}

export function saveCbtSettings(settings, storage = globalThis?.localStorage) {
  const normalized = normalizeCbtSettings(settings);
  try {
    storage?.setItem(CBT_SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // Private browsing or a full storage quota must not stop the exam.
  }
  return normalized;
}

export function shouldIgnoreExamShortcut(target) {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"));
}
