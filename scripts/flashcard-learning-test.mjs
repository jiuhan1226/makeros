import assert from "node:assert/strict";
import { applyCardResult, buildQuizChoices, cardMastery, filterCardsByMastery } from "../src/utils/flashcardLearning.js";

const cards = [
  { id: "a", front: "전압", back: "전위차" },
  { id: "b", front: "전류", back: "전하의 흐름" },
  { id: "c", front: "저항", back: "전류를 방해하는 정도" },
  { id: "d", front: "전력", back: "단위 시간당 전기에너지" },
];

assert.equal(cardMastery(cards[0]), "new", "처음 만든 카드는 새 카드여야 합니다.");
const learningPatch = applyCardResult(cards[0], "again", 1000);
assert.equal(learningPatch.studyStatus, "learning", "다시 보기 카드는 학습 중으로 바뀌어야 합니다.");
const knownPatch = applyCardResult({ ...cards[0], ...learningPatch }, "known", 2000);
assert.equal(knownPatch.studyStatus, "known", "알고 있어요를 선택하면 암기 완료로 바뀌어야 합니다.");
assert.equal(knownPatch.studyCount, 2, "카드 학습 횟수가 누적되어야 합니다.");

const choices = buildQuizChoices(cards[0], cards);
assert.equal(choices.length, 4, "선택 퀴즈는 최대 4개의 보기를 만들어야 합니다.");
assert.ok(choices.includes(cards[0].back), "선택 퀴즈에 정답이 포함되어야 합니다.");
assert.equal(new Set(choices).size, choices.length, "선택 퀴즈 보기는 중복되면 안 됩니다.");

const withStatus = [{ ...cards[0], studyStatus: "known" }, { ...cards[1], studyStatus: "learning" }, cards[2]];
assert.equal(filterCardsByMastery(withStatus, "known").length, 1, "암기 상태별 필터가 동작해야 합니다.");

console.log("[flashcard-learning-test] OK");
