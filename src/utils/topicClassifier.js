const TOPIC_FIELDS = ["topic", "chapter", "unit", "category", "subTopic", "keyword"];

const PLACEHOLDER_PATTERN = /^(미분류(?:\s*주제)?|분류\s*전|기타|공통|unknown|uncategorized|none|null|-+)$/i;

const STOPWORDS = new Set([
  "다음", "보기", "설명", "내용", "사항", "경우", "대한", "관한", "관련", "옳은", "옳지", "틀린", "것은", "것을", "것이",
  "가장", "적절한", "부적절한", "해당", "아닌", "있는", "없는", "하여", "위한", "에서", "으로", "이다", "한다", "되는",
  "정답", "문제", "선택지", "보기의", "중에서", "각각", "일반적", "기준", "방법", "종류", "특징", "설명으로", "다음과",
  "승강기", "장치", "시스템", "관리", "기능", "기초", "이론", "개론",
]);

const RULES = [
  // 승강기기능사 · 승강기개론
  { subject: /승강기개론/, topic: "권상기·구동장치", keywords: ["권상기", "권상", "트랙션", "시브", "기어리스", "감속기", "견인비", "구동기"] },
  { subject: /승강기개론/, topic: "와이어로프·체인", keywords: ["와이어로프", "로프", "체인", "소켓", "꼬임", "로핑", "장력"] },
  { subject: /승강기개론/, topic: "카·균형추·가이드레일", keywords: ["균형추", "카운터웨이트", "가이드레일", "가이드슈", "승강카", "케이지", "카바닥", "카틀"] },
  { subject: /승강기개론/, topic: "출입문·도어장치", keywords: ["도어", "출입문", "문닫힘", "문열림", "도어록", "인터록", "문턱", "행거롤러"] },
  { subject: /승강기개론/, topic: "안전장치", keywords: ["조속기", "비상정지", "세이프티기어", "완충기", "종단정지", "리미트스위치", "파이널리미트", "비상구출"] },
  { subject: /승강기개론/, topic: "유압식 승강기", keywords: ["유압식", "유압", "실린더", "플런저", "체크밸브", "릴리프밸브", "유압펌프"] },
  { subject: /승강기개론/, topic: "에스컬레이터·무빙워크", keywords: ["에스컬레이터", "무빙워크", "디딤판", "스텝", "핸드레일", "콤플레이트"] },
  { subject: /승강기개론/, topic: "운행성능·교통계산", keywords: ["수송능력", "운전간격", "교통계산", "정지층", "정격속도", "가속도", "감속도", "운행시간"] },

  // 승강기기능사 · 안전관리
  { subject: /안전관리/, topic: "검사·법규·자체점검", keywords: ["정기검사", "완성검사", "수시검사", "자체점검", "검사주기", "검사기준", "관리주체", "안전관리자", "법령", "승강기안전관리법"] },
  { subject: /안전관리/, topic: "산업재해·작업안전", keywords: ["산업재해", "재해", "안전수칙", "작업안전", "위험예지", "보호구", "안전표지", "추락", "낙하", "끼임"] },
  { subject: /안전관리/, topic: "전기·감전 안전", keywords: ["감전", "누전", "접지", "절연", "전기안전", "활선", "누전차단기"] },
  { subject: /안전관리/, topic: "화재·소화·비상대응", keywords: ["화재", "소화기", "소화", "방화", "비상대응", "구조", "피난"] },
  { subject: /안전관리/, topic: "안전점검·위험성평가", keywords: ["위험성평가", "안전점검", "점검표", "위험요인", "유해요인", "작업계획"] },

  // 승강기기능사 · 승강기보수
  { subject: /승강기보수/, topic: "정기점검·윤활·조정", keywords: ["정기점검", "점검", "윤활", "급유", "청소", "조정", "교체주기", "예방보전"] },
  { subject: /승강기보수/, topic: "권상기·브레이크 보수", keywords: ["브레이크", "제동기", "권상기", "감속기", "베어링", "전자브레이크"] },
  { subject: /승강기보수/, topic: "로프·시브·체인 보수", keywords: ["와이어로프", "로프", "시브", "도르래", "체인", "장력", "마모", "소선"] },
  { subject: /승강기보수/, topic: "도어·인터록 보수", keywords: ["도어", "인터록", "도어록", "문닫힘", "문열림", "행거", "도어슈"] },
  { subject: /승강기보수/, topic: "안전장치 점검", keywords: ["조속기", "비상정지", "세이프티기어", "완충기", "리미트", "안전장치"] },
  { subject: /승강기보수/, topic: "전기제어·고장진단", keywords: ["고장진단", "고장", "제어반", "릴레이", "접촉기", "퓨즈", "배선", "회로시험", "절연저항"] },
  { subject: /승강기보수/, topic: "유압장치 보수", keywords: ["유압", "실린더", "플런저", "밸브", "오일", "패킹", "유압펌프"] },

  // 승강기기능사 · 기계/전기 기초
  { subject: /(기계.*전기|전기.*기계|기초이론)/, topic: "기계요소·기계재료", keywords: ["볼트", "너트", "나사", "키", "핀", "베어링", "기어", "벨트", "축", "커플링", "스프링", "열처리", "경도", "인장강도"] },
  { subject: /(기계.*전기|전기.*기계|기초이론)/, topic: "힘·운동·동력", keywords: ["모멘트", "토크", "마찰", "일률", "동력", "관성", "가속도", "속도", "하중", "응력", "변형률"] },
  { subject: /(기계.*전기|전기.*기계|기초이론)/, topic: "직류·교류 회로", keywords: ["옴의법칙", "키르히호프", "저항", "전압", "전류", "직렬", "병렬", "교류", "주파수", "역률", "전력", "커패시턴스", "인덕턴스"] },
  { subject: /(기계.*전기|전기.*기계|기초이론)/, topic: "전동기·변압기", keywords: ["전동기", "모터", "유도전동기", "동기전동기", "직류기", "발전기", "변압기", "슬립", "기동전류"] },
  { subject: /(기계.*전기|전기.*기계|기초이론)/, topic: "시퀀스·제어기기", keywords: ["시퀀스", "릴레이", "전자접촉기", "접촉기", "타이머", "PLC", "자기유지", "인터록", "푸시버튼", "리미트스위치"] },
  { subject: /(기계.*전기|전기.*기계|기초이론)/, topic: "반도체·전자소자", keywords: ["다이오드", "트랜지스터", "사이리스터", "SCR", "제너", "정류", "반도체", "발광다이오드"] },
  { subject: /(기계.*전기|전기.*기계|기초이론)/, topic: "계측기·센서", keywords: ["전압계", "전류계", "멀티미터", "절연저항계", "측정", "계측", "센서", "검출기", "오실로스코프"] },

  // 여러 자격증에서 재사용할 수 있는 범용 규칙
  { topic: "법규·검사기준", keywords: ["법령", "시행규칙", "검사기준", "정기검사", "허가", "신고", "관리자", "법정"] },
  { topic: "안전관리·산업재해", keywords: ["산업재해", "안전관리", "위험성평가", "보호구", "안전표지", "재해율"] },
  { topic: "전기회로", keywords: ["옴의법칙", "키르히호프", "직렬회로", "병렬회로", "전압", "전류", "저항", "전력", "역률"] },
  { topic: "전동기·전기기기", keywords: ["전동기", "유도전동기", "동기전동기", "변압기", "발전기", "직류기"] },
  { topic: "제어·시퀀스", keywords: ["시퀀스", "PLC", "릴레이", "접촉기", "자기유지", "인터록", "타이머"] },
  { topic: "기계요소", keywords: ["베어링", "기어", "벨트", "체인", "축", "볼트", "너트", "키", "커플링"] },
  { topic: "재료·강도", keywords: ["응력", "변형률", "인장강도", "경도", "열처리", "피로", "탄성", "소성"] },
  { topic: "유압·공압", keywords: ["유압", "공압", "실린더", "펌프", "밸브", "압축공기"] },
  { topic: "유지보수·고장진단", keywords: ["보수", "점검", "윤활", "고장진단", "마모", "교체", "정비"] },
  { topic: "계측·센서", keywords: ["계측", "측정", "센서", "검출", "전압계", "전류계", "멀티미터"] },
  { topic: "반도체·전자소자", keywords: ["다이오드", "트랜지스터", "사이리스터", "반도체", "정류", "제너"] },
];

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function compact(value) {
  return clean(value).toLowerCase().replace(/[\s·ㆍ,./()\[\]{}_-]+/g, "");
}

export function isPlaceholderTopic(value) {
  const text = clean(value);
  return !text || PLACEHOLDER_PATTERN.test(text);
}

function isUsableManualTopic(value, subject) {
  const text = clean(value);
  if (isPlaceholderTopic(text)) return false;
  return compact(text) !== compact(subject);
}

function questionText(question = {}) {
  return [
    question.question,
    ...(Array.isArray(question.choices) ? question.choices : []),
    question.explanation,
  ].map(clean).filter(Boolean).join(" ");
}

function scoreRule(rule, subject, compactText) {
  if (rule.subject && !rule.subject.test(subject)) return null;
  const matchedKeywords = [];
  let score = rule.subject ? 5 : 0;
  for (const keyword of rule.keywords) {
    const normalized = compact(keyword);
    if (normalized && compactText.includes(normalized)) {
      matchedKeywords.push(keyword);
      score += 3 + Math.min(3, Math.floor(normalized.length / 3));
    }
  }
  if (!matchedKeywords.length) return null;
  return { topic: rule.topic, score, matchedKeywords };
}

function inferKeyword(text, subject) {
  const subjectParts = compact(subject).split(/[^가-힣a-z0-9]+/).filter(Boolean);
  const counts = new Map();
  const tokens = text.match(/[가-힣A-Za-z][가-힣A-Za-z0-9+·-]{1,18}/g) || [];
  for (const rawToken of tokens) {
    const token = clean(rawToken).replace(/^(대한|관련|다음|각각)/, "").replace(/(으로|에서|에는|의|은|는|이|가|을|를|와|과|에)$/g, "");
    if (token.length < 2 || STOPWORDS.has(token)) continue;
    const normalized = compact(token);
    if (!normalized || subjectParts.some((part) => part && (normalized === part || part.includes(normalized)))) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([token, count]) => ({ token, score: count * 5 + Math.min(token.length, 8) }))
    .sort((a, b) => b.score - a.score || b.token.length - a.token.length)[0]?.token || "";
}


export function classifyQuestionTopicFromContent(question = {}) {
  const subject = clean(question.subject) || "공통";
  const text = questionText(question);
  const compactText = compact(text);
  const matches = RULES
    .map((rule) => scoreRule(rule, subject, compactText))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (matches.length) {
    return {
      topic: matches[0].topic,
      source: "keyword-rule",
      confidence: Math.min(0.94, 0.68 + matches[0].matchedKeywords.length * 0.08),
      matchedKeywords: matches[0].matchedKeywords,
    };
  }

  const keyword = inferKeyword(text, subject);
  if (keyword) {
    return {
      topic: `${subject} · ${keyword}`,
      source: "keyword-fallback",
      confidence: 0.48,
      matchedKeywords: [keyword],
    };
  }

  return {
    topic: `${subject} · 기타 핵심개념`,
    source: "subject-fallback",
    confidence: 0.3,
    matchedKeywords: [],
  };
}

export function classifyQuestionTopic(question = {}) {
  const subject = clean(question.subject) || "공통";

  for (const field of TOPIC_FIELDS) {
    const value = question[field];
    if (typeof value === "string" && isUsableManualTopic(value, subject)) {
      return { topic: clean(value), source: "metadata", confidence: 1, matchedKeywords: [] };
    }
  }

  if (Array.isArray(question.tags)) {
    const tag = question.tags.map(clean).find((value) => isUsableManualTopic(value, subject));
    if (tag) return { topic: tag, source: "tag", confidence: 0.96, matchedKeywords: [tag] };
  }

  return classifyQuestionTopicFromContent(question);
}

function similarityTokens(value) {
  const tokens = clean(value)
    .toLowerCase()
    .match(/[가-힣a-z0-9]+/g) || [];
  return new Set(tokens.filter((token) => token.length >= 2 && !STOPWORDS.has(token)));
}

function characterBigrams(value) {
  const normalized = compact(value);
  const grams = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.add(normalized.slice(index, index + 2));
  }
  return grams;
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function topicSimilarity(left, right) {
  const tokenScore = jaccard(similarityTokens(left), similarityTokens(right));
  const gramScore = jaccard(characterBigrams(left), characterBigrams(right));
  const leftCompact = compact(left);
  const rightCompact = compact(right);
  const containment = leftCompact && rightCompact && (leftCompact.includes(rightCompact) || rightCompact.includes(leftCompact))
    ? 0.18
    : 0;
  return Math.min(1, tokenScore * 0.58 + gramScore * 0.42 + containment);
}

function itemProfile(item = {}) {
  return [
    item.topic,
    item.__contentTopic,
    item.question,
    ...(Array.isArray(item.choices) ? item.choices : []),
    item.explanation,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].map(clean).filter(Boolean).join(" ");
}

function questionKey(question = {}, index = 0) {
  return String(
    question.id
      || question.questionId
      || `${question.examId || question.sourceExamId || "exam"}:${question.questionNumber || index}`,
  );
}

/**
 * 세부 주제가 지나치게 잘게 나뉘는 것을 막는 표시용 통합 단계입니다.
 * 같은 과목 안에서 2문제 미만인 주제는 문제 본문의 규칙 기반 주제,
 * 기존 다빈도 주제와의 유사도, 과목별 기타 핵심개념 순서로 병합합니다.
 */
export function consolidateQuestionTopics(questions = [], { minTopicSize = 2 } = {}) {
  const minimum = Math.max(2, Number(minTopicSize) || 2);
  const prepared = questions.map((question, index) => {
    const normalized = normalizeQuestionTopic(question);
    const content = classifyQuestionTopicFromContent({
      ...question,
      topic: "",
      chapter: "",
      unit: "",
      category: "",
      subTopic: "",
      keyword: "",
      tags: [],
    });
    return {
      ...normalized,
      __originalTopic: normalized.topic,
      __contentTopic: content.topic,
      __contentTopicSource: content.source,
      __questionKey: questionKey(question, index),
    };
  });

  const bySubject = new Map();
  for (const item of prepared) {
    const subject = clean(item.subject) || "공통";
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(item);
  }

  const mergedQuestions = [];
  const mergeMap = new Map();
  let sparseTopicCount = 0;
  let mergedQuestionCount = 0;
  let originalTopicCount = 0;

  for (const [subject, items] of bySubject.entries()) {
    const originalGroups = new Map();
    const contentGroups = new Map();

    for (const item of items) {
      if (!originalGroups.has(item.__originalTopic)) originalGroups.set(item.__originalTopic, []);
      originalGroups.get(item.__originalTopic).push(item);
      if (!contentGroups.has(item.__contentTopic)) contentGroups.set(item.__contentTopic, []);
      contentGroups.get(item.__contentTopic).push(item);
    }

    originalTopicCount += originalGroups.size;
    sparseTopicCount += [...originalGroups.values()].filter((rows) => rows.length < minimum).length;

    const stableProfiles = new Map();
    const registerProfile = (topic, rows) => {
      if (!topic || isPlaceholderTopic(topic)) return;
      const profile = [topic, ...rows.map(itemProfile)].join(" ");
      const previous = stableProfiles.get(topic);
      stableProfiles.set(topic, previous ? `${previous} ${profile}` : profile);
    };

    for (const [topic, rows] of originalGroups.entries()) {
      if (rows.length >= minimum) registerProfile(topic, rows);
    }
    for (const [topic, rows] of contentGroups.entries()) {
      if (rows.length >= minimum && !/기타 핵심개념$/.test(topic)) registerProfile(topic, rows);
    }

    for (const item of items) {
      const originalRows = originalGroups.get(item.__originalTopic) || [];
      const contentRows = contentGroups.get(item.__contentTopic) || [];
      let finalTopic = item.__originalTopic;
      let mergeReason = "";

      if (originalRows.length < minimum) {
        if (contentRows.length >= minimum && !isPlaceholderTopic(item.__contentTopic)) {
          finalTopic = item.__contentTopic;
          mergeReason = "content-cluster";
        } else {
          let bestTopic = "";
          let bestScore = 0;
          const sourceProfile = itemProfile(item);
          for (const [candidateTopic, candidateProfile] of stableProfiles.entries()) {
            if (candidateTopic === item.__originalTopic) continue;
            const score = topicSimilarity(sourceProfile, `${candidateTopic} ${candidateProfile}`);
            if (score > bestScore) {
              bestScore = score;
              bestTopic = candidateTopic;
            }
          }
          if (bestTopic && bestScore >= 0.2) {
            finalTopic = bestTopic;
            mergeReason = "similar-topic";
          } else {
            finalTopic = `${subject} · 기타 핵심개념`;
            mergeReason = "subject-fallback";
          }
        }
      }

      const changed = finalTopic !== item.__originalTopic;
      if (changed) mergedQuestionCount += 1;
      mergeMap.set(`${subject}|||${item.__originalTopic}`, finalTopic);
      mergeMap.set(item.__questionKey, finalTopic);

      const {
        __originalTopic,
        __contentTopic,
        __contentTopicSource,
        __questionKey,
        ...question
      } = item;

      mergedQuestions.push({
        ...question,
        topic: finalTopic,
        topicSource: changed ? "consolidated" : question.topicSource,
        topicMergedFrom: changed ? __originalTopic : "",
        topicMergeReason: changed ? mergeReason : "",
        topicContentCandidate: __contentTopic,
        tags: [
          finalTopic,
          ...(Array.isArray(question.tags) ? question.tags : []),
        ]
          .map(clean)
          .filter((value) => value && !isPlaceholderTopic(value))
          .filter((value, index, values) => values.indexOf(value) === index)
          .slice(0, 8),
      });
    }
  }

  const finalTopicCount = new Set(
    mergedQuestions.map((question) => `${clean(question.subject) || "공통"}|||${question.topic}`),
  ).size;

  return {
    questions: mergedQuestions,
    mergeMap,
    stats: {
      originalTopicCount,
      finalTopicCount,
      sparseTopicCount,
      mergedQuestionCount,
    },
  };
}

export function normalizeQuestionTopic(question = {}) {
  const classification = classifyQuestionTopic(question);
  const subject = clean(question.subject) || "공통";
  const manualTags = Array.isArray(question.tags) ? question.tags : [];
  const tags = [classification.topic, ...manualTags]
    .map(clean)
    .filter((value) => !isPlaceholderTopic(value))
    .filter((value) => compact(value) !== compact(subject))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 8);

  return {
    ...question,
    topic: classification.topic,
    topicSource: classification.source,
    topicConfidence: classification.confidence,
    topicKeywords: classification.matchedKeywords,
    tags: tags.length ? tags : [classification.topic],
  };
}
