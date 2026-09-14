function stripMarkup(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function normalizeQuestionText(value) {
  return stripMarkup(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\s\u00a0]+/g, "")
    .trim();
}

function imageSignature(question) {
  const questionImages = Array.isArray(question?.questionImageUrls)
    ? question.questionImageUrls
    : question?.imageUrl ? [question.imageUrl] : [];
  const choiceImages = Array.isArray(question?.choiceImageUrls) ? question.choiceImageUrls : [];
  return [...questionImages, ...choiceImages]
    .map((value) => String(value || "").trim().split("?")[0])
    .filter(Boolean)
    .join("|");
}

export function questionContentKey(question, fallback = "") {
  const prompt = normalizeQuestionText(question?.question);
  const choices = (Array.isArray(question?.choices) ? question.choices : []).map(normalizeQuestionText);
  const answerIndex = Number(question?.answerIndex);
  const correctChoice = Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < choices.length
    ? choices[answerIndex]
    : `index:${Number.isFinite(answerIndex) ? answerIndex : "unknown"}`;
  const choiceSet = [...choices].sort((a, b) => a.localeCompare(b, "ko")).join("|");
  const images = imageSignature(question);

  if (!prompt && !choiceSet && !images) {
    return `fallback:${question?.id || question?.sourceQuestionId || fallback}`;
  }
  return `content:${prompt}::${choiceSet}::${correctChoice}::${images}`;
}

function sourceLabel(question) {
  return String(question?.examTitle || question?.sourceExam?.title || question?.sourceName || "").trim();
}

export function deduplicateQuestions(items = []) {
  const unique = [];
  const byKey = new Map();

  items.forEach((question, index) => {
    const key = questionContentKey(question, index);
    const source = sourceLabel(question);
    const existingIndex = byKey.get(key);
    if (existingIndex === undefined) {
      byKey.set(key, unique.length);
      unique.push({
        ...question,
        duplicateSources: source ? [source] : [],
      });
      return;
    }

    const existing = unique[existingIndex];
    const duplicateSources = source && !existing.duplicateSources?.includes(source)
      ? [...(existing.duplicateSources || []), source]
      : (existing.duplicateSources || []);
    unique[existingIndex] = {
      ...existing,
      explanation: existing.explanation || question.explanation || "",
      questionImageUrls: existing.questionImageUrls?.length ? existing.questionImageUrls : question.questionImageUrls,
      imageUrl: existing.imageUrl || question.imageUrl || "",
      choiceImageUrls: existing.choiceImageUrls?.some(Boolean) ? existing.choiceImageUrls : question.choiceImageUrls,
      duplicateSources,
    };
  });

  return {
    questions: unique,
    totalCount: items.length,
    duplicateCount: Math.max(0, items.length - unique.length),
  };
}

export function removeQuestionFromList(items = [], target) {
  const targetKey = questionContentKey(target);
  return items.filter((item, index) => questionContentKey(item, index) !== targetKey);
}
