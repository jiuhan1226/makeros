export function buildCalendarLaneMap(items = []) {
  const unique = [...new Map(items.map((item) => [String(item.rangeKey || item.id), item])).values()]
    .map((item) => ({
      key: String(item.rangeKey || item.id),
      start: String(item.rangeStart || item.date || ""),
      end: String(item.rangeEnd || item.date || ""),
      title: String(item.title || ""),
    }))
    .filter((item) => item.start)
    .sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end) || a.title.localeCompare(b.title, "ko"));
  const laneEnds = [];
  const lanes = new Map();
  unique.forEach((item) => {
    let lane = laneEnds.findIndex((end) => end < item.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = item.end || item.start;
    lanes.set(item.key, lane);
  });
  return lanes;
}
