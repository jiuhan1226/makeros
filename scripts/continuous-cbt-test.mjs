import assert from "node:assert/strict";
import { calculateCbtBlockProgress, selectContinuousPastQuestions } from "../src/utils/continuousCbt.js";
import { questionProgressId } from "../src/utils/learningEngine.js";

const first = calculateCbtBlockProgress({ targetMinutes: 75, elapsedSeconds: 11 * 60 + 3, answeredCount: 15 });
assert.equal(first.completedMinutes, 12, "75분 계획을 한 세트의 30분 제한시간으로 간주하면 안 됩니다.");
assert.equal(first.remainingMinutes, 63);
assert.equal(first.completed, false, "첫 세트 제출만으로 오늘 루틴을 완료하면 안 됩니다.");

const continued = calculateCbtBlockProgress({ targetMinutes: 75, completedMinutes: first.completedMinutes, elapsedSeconds: 14 * 60, answeredCount: 15 });
assert.equal(continued.completedMinutes, 26);
assert.equal(continued.remainingMinutes, 49);

const manuallyFinished = calculateCbtBlockProgress({ targetMinutes: 75, completedMinutes: 12, elapsedSeconds: 0, answeredCount: 0, forceComplete: true });
assert.equal(manuallyFinished.completed, true, "사용자가 명시적으로 오늘 루틴을 끝낼 수 있어야 합니다.");

const questions = Array.from({ length: 20 }, (_, index) => ({
  id: `q-${index + 1}`,
  question: `${index + 1}번 실제 기출문제`,
  choices: ["1", "2", "3", "4"],
  answerIndex: 0,
  subject: index < 8 ? "전기이론" : "전기기기",
  topic: index < 8 ? "교류회로" : "전동기",
}));
const seen = questions.slice(0, 4).map(questionProgressId);
const progress = [{ ...questions[6], questionId: questionProgressId(questions[6]), isCorrect: false, wrongStreak: 2 }];
const selection = selectContinuousPastQuestions({ questions, progress, seenQuestionIds: seen, recentWrongQuestions: [questions[6]], limit: 10 });
assert.equal(selection.questions.length, 10);
assert.equal(new Set(selection.questionIds).size, 10, "한 세트 안에 중복 문제가 없어야 합니다.");
assert.equal(selection.questionIds.some((id) => seen.includes(id)), false, "남은 미풀이 문제가 있으면 이미 본 문제를 다시 섞으면 안 됩니다.");
assert.equal(selection.questions[0].subject, "전기이론", "최근 오답과 같은 과목·유형을 다음 세트 앞쪽에 배치해야 합니다.");

console.log("continuous CBT tests passed");
