const DIFFICULTY_LABELS = ["쉬움", "보통", "어려움"];
const QUESTION_TYPE_LABELS = ["핵심 개념 확인", "원리 이해", "비교·구분", "계산·적용", "상황·자료 해석"];

export const TEACHER_QUESTION_PROFILE = Object.freeze({
  id: "teacher-survey-2026-09",
  responseCount: 8,
  difficultyRatio: Object.freeze({ 쉬움: 0.3, 보통: 0.5, 어려움: 0.2 }),
  typeRatio: Object.freeze({
    "핵심 개념 확인": 0.3,
    "원리 이해": 0.2,
    "비교·구분": 0.15,
    "계산·적용": 0.15,
    "상황·자료 해석": 0.2,
  }),
});

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function allocate(count, entries) {
  const total = Math.max(1, Math.floor(Number(count) || 1));
  const prepared = entries.map(([label, weight], index) => {
    const exact = total * weight;
    return { label, index, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = total - prepared.reduce((sum, item) => sum + item.count, 0);
  [...prepared]
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach((item) => {
      if (remaining <= 0) return;
      prepared[item.index].count += 1;
      remaining -= 1;
    });
  return Object.fromEntries(prepared.map((item) => [item.label, item.count]));
}

export function buildTeacherQuestionBlueprint({ count = 10, difficultyMode = "교사 추천 혼합" } = {}) {
  const total = Math.min(Math.max(Math.floor(Number(count) || 10), 1), 20);
  const requestedDifficulty = DIFFICULTY_LABELS.includes(difficultyMode) ? difficultyMode : "교사 추천 혼합";
  const difficulty = requestedDifficulty === "교사 추천 혼합"
    ? allocate(total, Object.entries(TEACHER_QUESTION_PROFILE.difficultyRatio))
    : Object.fromEntries(DIFFICULTY_LABELS.map((label) => [label, label === requestedDifficulty ? total : 0]));
  const questionTypes = allocate(total, Object.entries(TEACHER_QUESTION_PROFILE.typeRatio));
  return {
    profileId: TEACHER_QUESTION_PROFILE.id,
    responseCount: TEACHER_QUESTION_PROFILE.responseCount,
    total,
    requestedDifficulty,
    difficulty,
    questionTypes,
  };
}

export function teacherBlueprintPrompt(blueprint, focus = "") {
  const difficulty = Object.entries(blueprint.difficulty).filter(([, count]) => count > 0).map(([label, count]) => `${label} ${count}문항`).join(", ");
  const questionTypes = Object.entries(blueprint.questionTypes).filter(([, count]) => count > 0).map(([label, count]) => `${label} ${count}문항`).join(", ");
  const safeFocus = normalizeText(focus).slice(0, 600);
  return `교사 출제 설문 기준(${blueprint.responseCount}명 응답):
- 난이도 구성: ${difficulty}
- 문항 유형 구성: ${questionTypes}
- 내용 선정 우선순위: 학습목표와 직접 관련된 내용, 수업에서 강조한 내용, 반드시 알아야 하는 기본 개념, 다른 개념의 바탕이 되는 핵심 원리
- 제외 대상: 지엽적이거나 활용도가 낮은 내용, 자료에 근거가 없는 내용, 여러 답으로 해석되는 내용, 선택 범위 밖의 내용
- 오답 설계: 비슷한 개념, 서로 혼동하기 쉬운 용어, 학생이 자주 하는 실수, 계산 과정에서 나올 수 있는 값을 사용
- 문항 검수: 정답 정확성, 자료 근거, 복수 정답 가능성, 오답 품질, 문장 자연스러움, 문항 간 중복 순으로 확인
${safeFocus ? `- 사용자가 입력한 학습목표·강조 내용: ${safeFocus}` : "- 별도 강조 내용 없음: PDF에서 반복되거나 정의·원리·절차의 중심이 되는 내용을 우선"}`;
}

function grams(value) {
  const text = normalizeText(value).replace(/[^\p{L}\p{N}]/gu, "");
  if (text.length < 3) return new Set(text ? [text] : []);
  return new Set(Array.from({ length: text.length - 2 }, (_, index) => text.slice(index, index + 3)));
}

export function questionSimilarity(left, right) {
  const a = grams(left);
  const b = grams(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach((item) => { if (b.has(item)) intersection += 1; });
  return intersection / (a.size + b.size - intersection);
}

export function validateTeacherQuestion(question) {
  const issues = [];
  const prompt = normalizeText(question?.question);
  const choices = Array.isArray(question?.choices) ? question.choices.map(normalizeText) : [];
  const choiceKeys = choices.map((choice) => choice.replace(/[^\p{L}\p{N}]/gu, ""));
  const answerIndex = Number(question?.answerIndex);
  const choiceExplanations = Array.isArray(question?.choiceExplanations) ? question.choiceExplanations.map(normalizeText) : [];

  if (prompt.length < 12) issues.push("질문이 지나치게 짧음");
  if (choices.length !== 5 || choices.some((choice) => !choice)) issues.push("5개 선택지 필요");
  if (choiceKeys.length !== new Set(choiceKeys).size) issues.push("중복 선택지");
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= choices.length) issues.push("정답 번호 오류");
  if (!DIFFICULTY_LABELS.includes(normalizeText(question?.difficulty))) issues.push("난이도 분류 누락");
  if (!QUESTION_TYPE_LABELS.includes(normalizeText(question?.questionType))) issues.push("문항 유형 분류 누락");
  if (normalizeText(question?.learningObjective).length < 2) issues.push("핵심 개념 누락");
  if (normalizeText(question?.selectionReason).length < 8) issues.push("출제 이유 부족");
  if (normalizeText(question?.explanation).length < 15) issues.push("정답 해설 부족");
  if (choiceExplanations.length !== 5 || choiceExplanations.some((reason) => reason.length < 5)) issues.push("선택지별 판단 근거 부족");
  if (/정답\s*(없음|없다)|모두\s*(정답|옳다|맞다)/.test(choices.join(" "))) issues.push("단일 정답을 흐리는 선택지");
  return { ok: issues.length === 0, issues };
}

export function deduplicateTeacherQuestions(questions = [], threshold = 0.72) {
  const selected = [];
  for (const question of questions) {
    if (selected.some((item) => questionSimilarity(item.question, question.question) >= threshold)) continue;
    selected.push(question);
  }
  return selected;
}

export function applyTeacherReview(questions = [], reviews = []) {
  const reviewMap = new Map((Array.isArray(reviews) ? reviews : []).map((review) => [Number(review?.index), review]));
  return questions.flatMap((question, index) => {
    const review = reviewMap.get(index);
    const accepted = review?.accepted === true
      && review?.sourceSupported === true
      && review?.singleCorrectAnswer === true
      && review?.distractorsPlausible === true
      && Number(review?.answerIndex) === Number(question.answerIndex)
      && (!Array.isArray(review?.issues) || review.issues.length === 0);
    if (!accepted) return [];
    return [{
      ...question,
      aiGenerated: true,
      teacherReviewStatus: "verified",
      teacherReviewModel: normalizeText(review?.model || ""),
    }];
  });
}

