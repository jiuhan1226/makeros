import crypto from "node:crypto";

export const OPPORTUNITY_SOURCES = [
  { id: "contestkorea", name: "콘테스트코리아", url: "https://www.contestkorea.com/sub/list.php?int_gbn=1", type: "공모전" },
  { id: "allforyoung", name: "요즘것들", url: "https://www.allforyoung.com/posts/contest", type: "공모전·대외활동" },
  { id: "youth", name: "청소년활동정보서비스", url: "https://www.youth.go.kr/youth/act/actSearch/actSearchLst.yt", type: "청소년 활동" },
  { id: "wevity", name: "WEVITY 청소년", url: "https://www.wevity.com/?c=find&cidx=30&gub=2&s=1", type: "공모전" },
];

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
    .trim();
}

function titleKey(value = "") {
  return canonicalTitle(value).toLowerCase().replace(/(?:19|20)\d{2}/g, "").replace(/제\s*\d+\s*회/g, "").replace(/[^가-힣a-z0-9]/g, "");
}

function audienceEvidence(context = "") {
  const positive = context.match(/(?:고등학생|중·?고등학생|청소년|중학생|초·?중·?고|만\s*1[3-9]세|학생 누구나|전 국민|전국민|누구나|연령 제한 없음)/i)?.[0] || "";
  const exclusiveCollege = /(?:대학생만|대학\(원\)생만|대학생\s*대상|대학원생\s*대상)/i.test(context)
    && !/(?:고등학생|청소년|중학생|누구나|전국민|전 국민)/i.test(context);
  return { eligible: Boolean(positive) && !exclusiveCollege, evidence: positive || "상세 공고에서 참가 대상을 확인하세요." };
}

function dateParts(text = "") {
  const matches = [...text.matchAll(/(?:(20\d{2})[.\-/년]\s*)?(\d{1,2})[.\-/월]\s*(\d{1,2})\s*일?/g)];
  if (!matches.length) return { deadline: "", dday: "" };
  const last = matches.at(-1);
  const now = new Date();
  let year = Number(last[1] || now.getFullYear());
  const month = Number(last[2]);
  const day = Number(last[3]);
  if (!last[1] && month < now.getMonth() + 1 - 6) year += 1;
  const deadlineDate = new Date(year, month - 1, day, 23, 59, 59);
  if (Number.isNaN(deadlineDate.getTime())) return { deadline: "", dday: "" };
  const deadline = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const days = Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000);
  return { deadline, dday: days >= 0 ? `D-${days}` : "마감" };
}

function categoryOf(value = "") {
  if (/봉사|자원봉사/i.test(value)) return "봉사";
  if (/캠프|교육|멘토링|체험|연수|아카데미/i.test(value)) return "교육·캠프";
  if (/서포터|기자단|홍보대사|대외활동/i.test(value)) return "대외활동";
  return "공모전";
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
  return decode(html.slice(Math.max(0, anchorIndex - 450), anchorIndex + anchorLength + 950));
}

export function parseOpportunityHtml(html = "", source = OPPORTUNITY_SOURCES[0]) {
  if (source.id === "wevity") {
    const results = [];
    const pattern = /<a[^>]+href=["']([^"']*gbn=viewok[^"']*ix=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = pattern.exec(html)) && results.length < 45) {
      const title = canonicalTitle(match[3]);
      const context = decode(html.slice(Math.max(0, match.index - 500), match.index + 1800));
      const audience = audienceEvidence(context || "청소년");
      if (title.length < 8 || /전체|스페셜|접수중|접수예정$/.test(title)) continue;
      const date = dateParts(context);
      results.push({ id: `${source.id}-${match[2]}`, title, url: absoluteUrl(match[1], source.url), source: source.name, sourceUrl: source.url, sourceType: source.type, categories: categoryOf(`${title} ${context}`), organization: organizationOf(context), audienceEvidence: audience.evidence || "청소년", verifiedAudience: true, ...date });
    }
    return results;
  }

  const results = [];
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) && results.length < 80) {
    const title = canonicalTitle(match[2]);
    if (title.length < 9 || title.length > 120 || /로그인|회원가입|전체보기|더보기|이전|다음|공지사항|이용약관|개인정보|메뉴|검색/.test(title)) continue;
    const url = absoluteUrl(match[1], source.url);
    if (!url || !/^https?:/.test(url)) continue;
    const context = itemContext(html, match.index, match[0].length);
    const audience = audienceEvidence(`${title} ${context}`);
    const titleIsCollegeOnly = /(?:대학생만|대학\(원\)생만|대학생\s*전용|대학생\s*대상)/i.test(title) && !/(?:고등학생|청소년|누구나|전국민)/i.test(title);
    if (!audience.eligible || titleIsCollegeOnly) continue;
    const date = dateParts(context);
    results.push({
      id: `${source.id}-${crypto.createHash("sha1").update(url || title).digest("hex").slice(0, 12)}`,
      title,
      url,
      source: source.name,
      sourceUrl: source.url,
      sourceType: source.type,
      categories: categoryOf(`${title} ${context}`),
      organization: organizationOf(context),
      audienceEvidence: audience.evidence,
      verifiedAudience: true,
      ...date,
    });
  }
  return results;
}

export function dedupeOpportunities(items = []) {
  const seen = new Map();
  for (const item of items) {
    const key = titleKey(item.title);
    if (!key || key.length < 5) continue;
    const current = seen.get(key);
    if (!current || (!current.deadline && item.deadline)) seen.set(key, item);
  }
  return [...seen.values()].sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return a.title.localeCompare(b.title, "ko");
  });
}

export async function collectOpportunities(fetchImpl = fetch) {
  const checks = await Promise.all(OPPORTUNITY_SOURCES.map(async (source) => {
    try {
      const response = await fetchImpl(source.url, { headers: { accept: "text/html,application/xhtml+xml", "accept-language": "ko-KR,ko;q=0.9", "user-agent": "Mozilla/5.0 MakerOS/3.1.23" }, redirect: "follow", signal: AbortSignal.timeout(11000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const items = parseOpportunityHtml(await response.text(), source);
      if (!items.length) throw new Error("참여 대상이 확인된 공고를 찾지 못함");
      return { source, ok: true, count: items.length, items };
    } catch (error) {
      return { source, ok: false, count: 0, items: [], error: String(error?.message || error) };
    }
  }));
  const items = dedupeOpportunities(checks.flatMap((check) => check.items));
  return {
    items: items.slice(0, 80),
    sources: checks.map((check) => ({ id: check.source.id, name: check.source.name, url: check.source.url, ok: check.ok, count: check.count })),
    warning: checks.every((check) => !check.ok) ? "공개 공고 출처가 모두 지연되고 있습니다. 아래 출처 버튼에서 직접 확인해 주세요." : checks.some((check) => !check.ok) ? "일부 공고 출처가 지연되어 연결된 출처의 결과만 표시합니다." : "",
    checkedAt: Date.now(),
  };
}
