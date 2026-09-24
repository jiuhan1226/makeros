import crypto from "node:crypto";

export const OPPORTUNITY_SOURCES = [
  { id: "contestkorea", name: "콘테스트코리아", url: "https://www.contestkorea.com/sub/list.php?int_gbn=1", type: "공모전", kind: "aggregator" },
  { id: "wevity", name: "WEVITY 청소년", url: "https://www.wevity.com/?c=find&cidx=30&gub=2&s=1", type: "공모전", kind: "aggregator", audienceDefault: "청소년" },
  { id: "sen-career", name: "서울특별시교육청 진로교육", url: "https://www.sen.go.kr/user/bbs/BD_selectBbsList.do?q_bbsSn=1450", type: "교육청 공고", kind: "official" },
  { id: "goe-notice", name: "경기도교육청 공지사항", url: "https://www.goe.go.kr/goe/na/ntt/selectNttList.do?mi=10961", type: "교육청 공고", kind: "official" },
  { id: "cne-notice", name: "충청남도교육청", url: "https://www.cne.go.kr/", type: "교육청 공고", kind: "official" },
  { id: "moe-business", name: "교육부 사업공고", url: "https://www.moe.go.kr/boardCnts/listRenew.do?boardID=72755&m=031302&opType=N", type: "교육부 공고", kind: "official" },
];
const sourceHealth = new Map();

function decode(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ").trim();
}

function absoluteUrl(value, base) {
  try { return new URL(String(value || "").replace(/&amp;/g, "&"), base).href; }
  catch { return ""; }
}

function canonicalTitle(value = "") {
  return decode(value)
    .replace(/\s*(?:NEW|신규|마감임박|접수중|접수예정)\s*$/gi, "")
    .replace(/^\[[^\]]{1,18}\]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
}

function titleKey(value = "") {
  return canonicalTitle(value).toLowerCase().replace(/(?:19|20)\d{2}/g, "").replace(/제\s*\d+\s*회/g, "").replace(/[^가-힣a-z0-9]/g, "");
}

const CONTEST_WORDS = /(?:공모전|경진대회|경연대회|기능경기대회|해커톤|아이디어\s*(?:대회|공모)|콘테스트|챌린지|올림피아드|작품\s*공모|영상\s*공모|UCC\s*공모|발명품\s*(?:대회|경진))/i;
const ANNOUNCEMENT_WORDS = /(?:모집|접수|응모|참가|신청|출품|제출|개최|공고|공모전|경진대회|경연대회|해커톤|콘테스트|챌린지|올림피아드)/i;
const NON_ANNOUNCEMENT_WORDS = /(?:찾는\s*(?:법|방법)|전체\s*(?:현황|보기)|(?:대회[·ㆍ]?공모전|공모전[·ㆍ]?대회)\s*전체|바로가기|요약|분석\s*결과|과거\s*수상작|수상작\s*(?:발표|분석)|심사\s*결과|선정\s*결과|결과\s*발표|후기|전략\s*참고|가이드|일정\s*모음|뉴스|인터뷰|공지사항$)/i;

function audienceEvidence(context = "", source = {}) {
  const positive = context.match(/(?:고등학생|중[·ㆍ]?고등학생|청소년|중학생|초[·ㆍ]?중[·ㆍ]?고|초중고|학생\s*(?:누구나|대상)|만\s*1[3-9]세|전\s*국민|전국민|누구나|연령\s*제한\s*없음)/i)?.[0] || source.audienceDefault || "";
  const exclusiveCollege = /(?:대학생만|대학\(원\)생만|대학생\s*(?:전용|대상)|대학원생\s*대상)/i.test(context)
    && !/(?:고등학생|청소년|중학생|누구나|전국민|전\s*국민)/i.test(context);
  return { eligible: Boolean(positive) && !exclusiveCollege, evidence: positive };
}

export function opportunityDateParts(text = "", nowValue = Date.now()) {
  const rawText = String(text);
  const matches = [...rawText.matchAll(/(?:(20\d{2})[.\-/년]\s*)?(\d{1,2})[.\-/월]\s*(\d{1,2})\s*일?/g)];
  if (!matches.length) return { deadline: "", dday: "", deadlineValid: false };
  const nowMs = Number(nowValue) || Date.now();
  const nowKst = new Date(nowMs + 9 * 60 * 60 * 1000);
  const today = {
    year: nowKst.getUTCFullYear(),
    month: nowKst.getUTCMonth() + 1,
    day: nowKst.getUTCDate(),
  };
  const todayKey = Date.UTC(today.year, today.month - 1, today.day);
  const future = [];
  for (const [index, match] of matches.entries()) {
    let year = Number(match[1] || today.year);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!match[1] && month < today.month - 6) year += 1;
    const calendarKey = Date.UTC(year, month - 1, day);
    const calendarDate = new Date(calendarKey);
    if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) continue;
    const value = Date.UTC(year, month - 1, day, 14, 59, 59); // 해당 날짜 23:59 KST
    const days = Math.round((calendarKey - todayKey) / 86400000);
    const previous = matches[index - 1];
    const between = previous ? rawText.slice(Number(previous.index || 0) + previous[0].length, Number(match.index || 0)) : "";
    const before = rawText.slice(Math.max(0, Number(match.index || 0) - 45), Number(match.index || 0));
    const after = rawText.slice(Number(match.index || 0) + match[0].length, Number(match.index || 0) + match[0].length + 12);
    const nearby = `${before} ${after}`;
    const rangeEnd = Boolean(previous && /^[\s~〜–—-]+$/.test(between));
    const rangeContext = rangeEnd
      ? rawText.slice(Math.max(0, Number(previous.index || 0) - 45), Number(previous.index || 0))
      : "";
    const applicationLabel = /(?:접수|신청|지원|응모|제출|모집|공모)(?:\s*(?:기간|마감|기한|일정))?\s*[:：]?\s*$/i;
    const explicitDeadline = /(?:접수|신청|지원|응모|제출|모집)?\s*(?:마감|기한|마감일)\s*[:：]?\s*$/i;
    const otherEvent = /(?:본선|결선|시상|발표|개최|행사|심사|수상|설명회)\s*[:：]?\s*$/i;
    const endOfApplications = rangeEnd && applicationLabel.test(rangeContext);
    const rank = otherEvent.test(before) ? 0
      : explicitDeadline.test(before) ? 3
      : endOfApplications ? 2
      : applicationLabel.test(before) || (/(?:마감|까지)/.test(after) && /(?:접수|신청|지원|응모|제출|모집)/.test(before)) ? 1 : 0;
    if (days >= 0 && rank) future.push({ value, year, month, day, days, rank });
  }
  if (!future.length) return { deadline: "", dday: "", deadlineValid: false };
  // 개최일·발표일이 접수 마감보다 뒤에 있어도 마감일로 대체하지 않습니다.
  const selected = future.sort((a, b) => b.rank - a.rank || a.value - b.value)[0];
  return {
    deadline: `${selected.year}-${String(selected.month).padStart(2, "0")}-${String(selected.day).padStart(2, "0")}`,
    dday: selected.days === 0 ? "오늘 마감" : `D-${selected.days}`,
    deadlineValid: true,
  };
}

function categoryOf(value = "") {
  if (/해커톤|SW|소프트웨어|코딩|AI|데이터|로봇/i.test(value)) return "IT·소프트웨어";
  if (/과학|공학|전기|전자|기계|환경|에너지|발명/i.test(value)) return "과학·공학";
  if (/창업|비즈니스|직무|취업/i.test(value)) return "취업·창업";
  if (/영상|UCC|사진|디자인|문학|글|슬로건|웹툰/i.test(value)) return "콘텐츠·디자인";
  return "기타 공모전";
}

function organizationOf(context = "") {
  return context.match(/(?:주최|주관|기관)\s*[:：]\s*([^|·]{2,50})/i)?.[1]?.trim() || "";
}

function itemContext(html, anchorIndex, anchorLength) {
  const before = html.slice(Math.max(0, anchorIndex - 2200), anchorIndex);
  const candidates = ["article", "li", "tr"].map((tag) => ({ tag, index: before.toLowerCase().lastIndexOf(`<${tag}`) })).filter((item) => item.index >= 0).sort((a, b) => b.index - a.index);
  if (candidates.length) {
    const selected = candidates[0];
    const start = Math.max(0, anchorIndex - before.length + selected.index);
    const tail = html.slice(anchorIndex + anchorLength, anchorIndex + anchorLength + 3200);
    const closeAt = tail.toLowerCase().indexOf(`</${selected.tag}>`);
    if (closeAt >= 0) return decode(html.slice(start, anchorIndex + anchorLength + closeAt + selected.tag.length + 3));
  }
  return decode(html.slice(Math.max(0, anchorIndex - 500), anchorIndex + anchorLength + 1200));
}

function detailUrlLooksValid(url = "", source = {}) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    const route = `${parsed.pathname}${parsed.search}`.toLowerCase();
    if (/\/(?:login|join|search)(?:\.|\/|\?|$)/.test(route)) return false;
    if (source.id === "wevity") return /gbn=viewok/.test(route) && /(?:\?|&)ix=\d+/.test(route);
    if (source.id === "contestkorea") return !/\/sub\/list\.php/.test(route) && /(?:view|int_gbn|txt_bcode|no=|idx=)/.test(route);
    return parsed.pathname !== "/" && !/(?:list|index|main)(?:\.[a-z]+)?(?:\?|$)/.test(route);
  } catch { return false; }
}

function candidateFrom({ title, url, context, source }) {
  const cleanTitle = canonicalTitle(title);
  if (cleanTitle.length < 8 || cleanTitle.length > 140) return null;
  if (!CONTEST_WORDS.test(cleanTitle) || NON_ANNOUNCEMENT_WORDS.test(cleanTitle)) return null;
  if (!ANNOUNCEMENT_WORDS.test(`${cleanTitle} ${context}`) || !detailUrlLooksValid(url, source)) return null;
  return { title: cleanTitle, url, context, source };
}

function parseOpportunityCandidates(html = "", source = OPPORTUNITY_SOURCES[0]) {
  const results = [];
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) && results.length < 60) {
    const url = absoluteUrl(match[1], source.url);
    const context = itemContext(html, match.index, match[0].length);
    const candidate = candidateFrom({ title: match[2], url, context, source });
    if (candidate) results.push(candidate);
  }
  return results;
}

function officialLinkFromHtml(html = "", candidate = {}) {
  if (candidate.source?.kind === "official") return candidate.url;
  let sourceHost = "";
  try { sourceHost = new URL(candidate.source?.url || candidate.url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
  const links = [...String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: absoluteUrl(match[1], candidate.url), label: decode(match[2]) }))
    .filter((item) => {
      try {
        const parsed = new URL(item.url);
        const host = parsed.hostname.replace(/^www\./, "");
        if (!/^https?:$/.test(parsed.protocol) || !host || host === sourceHost || host.endsWith(`.${sourceHost}`)) return false;
        if (/instagram|facebook|youtube|twitter|x\.com|naver\.com|kakao|contestkorea|wevity/i.test(host)) return false;
        return /공식|홈페이지|접수|신청|주최|공고|바로가기/i.test(item.label) || /apply|contest|competition|notice|event|program|festival/i.test(`${host}${parsed.pathname}`);
      } catch { return false; }
    });
  return links[0]?.url || "";
}

function verifyCandidate(candidate, detailText = "", { requireOfficial = false } = {}) {
  const { source, title, url } = candidate;
  const context = decode(`${candidate.context || ""} ${detailText || ""}`);
  if (NON_ANNOUNCEMENT_WORDS.test(title) || !CONTEST_WORDS.test(title) || !ANNOUNCEMENT_WORDS.test(`${title} ${context}`)) return null;
  const audience = audienceEvidence(`${title} ${context}`, source);
  if (!audience.eligible) return null;
  const date = opportunityDateParts(context);
  const ongoing = /(?:상시\s*(?:모집|접수|공모)|마감\s*시까지)/i.test(context);
  if (!date.deadlineValid && !ongoing) return null;
  const officialUrl = officialLinkFromHtml(detailText, candidate);
  if (requireOfficial && source.kind !== "official" && !officialUrl) return null;
  return {
    id: `${source.id}-${crypto.createHash("sha1").update(url || title).digest("hex").slice(0, 12)}`,
    title,
    url: officialUrl || url,
    listingUrl: source.kind === "official" ? "" : url,
    officialUrl: officialUrl || (source.kind === "official" ? url : ""),
    source: source.name,
    sourceUrl: source.url,
    sourceType: source.type,
    sourceKind: source.kind || "aggregator",
    categories: categoryOf(`${title} ${context}`),
    organization: organizationOf(context),
    audienceEvidence: audience.evidence,
    verifiedAudience: true,
    verifiedAnnouncement: true,
    verification: ["공모·대회명", "모집·접수 공고", "학생 참여 대상", ongoing ? "상시 접수" : "유효한 마감일", officialUrl ? "주최기관 링크" : "상세 페이지"],
    deadline: ongoing && !date.deadline ? "상시" : date.deadline,
    dday: ongoing && !date.dday ? "상시 접수" : date.dday,
  };
}

export function parseOpportunityHtml(html = "", source = OPPORTUNITY_SOURCES[0]) {
  return parseOpportunityCandidates(html, source).map((candidate) => verifyCandidate(candidate)).filter(Boolean);
}

export function dedupeOpportunities(items = []) {
  const seen = new Map();
  for (const item of items) {
    const key = titleKey(item.title);
    if (!key || key.length < 5) continue;
    const current = seen.get(key);
    const candidateScore = (item.sourceKind === "official" ? 2 : 0) + (item.deadline && item.deadline !== "상시" ? 1 : 0);
    const currentScore = current ? (current.sourceKind === "official" ? 2 : 0) + (current.deadline && current.deadline !== "상시" ? 1 : 0) : -1;
    if (!current || candidateScore > currentScore) seen.set(key, item);
  }
  return [...seen.values()].sort((a, b) => {
    if (a.deadline === "상시" && b.deadline !== "상시") return 1;
    if (b.deadline === "상시" && a.deadline !== "상시") return -1;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    return a.title.localeCompare(b.title, "ko");
  });
}

async function fetchText(fetchImpl, url, timeout = 9000) {
  const response = await fetchImpl(url, {
    headers: { accept: "text/html,application/xhtml+xml", "accept-language": "ko-KR,ko;q=0.9", "user-agent": "Mozilla/5.0 MakerOS/3.1.31" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function verifySourceCandidates(fetchImpl, source, html) {
  const candidates = parseOpportunityCandidates(html, source);
  const verified = [];
  for (let index = 0; index < candidates.slice(0, 18).length; index += 6) {
    const batch = await Promise.all(candidates.slice(0, 18).slice(index, index + 6).map(async (candidate) => {
      try { return verifyCandidate(candidate, await fetchText(fetchImpl, candidate.url, 7000), { requireOfficial: source.kind !== "official" }); }
      catch { return null; }
    }));
    verified.push(...batch.filter(Boolean));
  }
  return verified;
}

export async function collectOpportunities(fetchImpl = fetch) {
  const checks = await Promise.all(OPPORTUNITY_SOURCES.map(async (source) => {
    try {
      const html = await fetchText(fetchImpl, source.url, 11000);
      const items = await verifySourceCandidates(fetchImpl, source, html);
      if (!items.length) throw new Error("검증 조건을 모두 통과한 진행 중 공고가 없음");
      const previous = sourceHealth.get(source.id) || {};
      const health = { failureCount: 0, lastSuccessAt: Date.now(), lastErrorAt: previous.lastErrorAt || 0 };
      sourceHealth.set(source.id, health);
      return { source, ok: true, count: items.length, items, ...health };
    } catch (error) {
      const previous = sourceHealth.get(source.id) || {};
      const health = { failureCount: Number(previous.failureCount || 0) + 1, lastSuccessAt: Number(previous.lastSuccessAt || 0), lastErrorAt: Date.now() };
      sourceHealth.set(source.id, health);
      return { source, ok: false, count: 0, items: [], error: String(error?.message || error), ...health };
    }
  }));
  const items = dedupeOpportunities(checks.flatMap((check) => check.items));
  return {
    items: items.slice(0, 80),
    sources: checks.map((check) => ({ id: check.source.id, name: check.source.name, url: check.source.url, kind: check.source.kind, ok: check.ok, count: check.count, failureCount: check.failureCount || 0, lastSuccessAt: check.lastSuccessAt || 0, lastErrorAt: check.lastErrorAt || 0 })),
    warning: checks.every((check) => !check.ok)
      ? "현재 검증을 통과한 진행 중 공고를 찾지 못했습니다. 출처의 새 공고가 확인되면 표시됩니다."
      : checks.some((check) => !check.ok) ? "일부 출처가 지연되었거나 검증을 통과한 진행 중 공고가 없어, 확인된 공고만 표시합니다." : "",
    checkedAt: Date.now(),
  };
}
