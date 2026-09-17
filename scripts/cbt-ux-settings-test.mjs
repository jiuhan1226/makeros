import assert from "node:assert/strict";
import fs from "node:fs";
import { DEFAULT_CBT_SETTINGS, normalizeCbtSettings, readCbtSettings, saveCbtSettings } from "../src/utils/cbtPreferences.js";

const memoryStorage = (() => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
})();

assert.deepEqual(readCbtSettings(memoryStorage), DEFAULT_CBT_SETTINGS, "default CBT settings should be stable");
const saved = saveCbtSettings({
  keyboardNavigation: false,
  miniNavigator: true,
  navigatorSize: "large",
  layout: "split",
  contentScale: "compact",
  answerSheet: "hidden",
}, memoryStorage);
assert.deepEqual(readCbtSettings(memoryStorage), saved, "CBT preferences should persist safely");

const invalid = normalizeCbtSettings({ navigatorSize: "giant", layout: "unknown", contentScale: "tiny", answerSheet: "maybe" });
assert.equal(invalid.navigatorSize, "normal");
assert.equal(invalid.layout, "auto");
assert.equal(invalid.contentScale, "normal");
assert.equal(invalid.answerSheet, "visible");
assert.equal(normalizeCbtSettings({ layout: "focus", answerSheet: "visible" }).answerSheet, "hidden", "focus mode should hide the answer sheet");

const examSource = fs.readFileSync(new URL("../src/pages/ExamPage.jsx", import.meta.url), "utf8");
const miniSource = fs.readFileSync(new URL("../src/components/ExamMiniNavigator.jsx", import.meta.url), "utf8");
const settingsSource = fs.readFileSync(new URL("../src/components/CbtSettingsPanel.jsx", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

assert.match(examSource, /ArrowLeft/);
assert.match(examSource, /ArrowRight/);
assert.match(examSource, /shouldIgnoreExamShortcut/);
assert.match(miniSource, /setPointerCapture/);
assert.match(miniSource, /CBT_MINI_POSITION_KEY/);
assert.match(settingsSource, /키보드 방향키/);
assert.match(settingsSource, /미니 방향키 크기/);
assert.match(settingsSource, /화면 배치/);
assert.match(settingsSource, /화면 크기/);
assert.match(settingsSource, /계속 보임/);
assert.match(cssSource, /\.exam-scroll-area\{min-width:0;min-height:0\}/);
assert.match(cssSource, /grid-template-rows:auto minmax\(0,1fr\) 78px/);
assert.match(cssSource, /\.answer-sheet-scroll\{height:auto!important;min-height:0;flex:1;overflow-y:auto/);

console.log("CBT UX settings test passed");
