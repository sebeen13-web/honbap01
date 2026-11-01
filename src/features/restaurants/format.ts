/** 350m, 1.2km 형식 (1km 미만은 10m 단위로 반올림) */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatRadius(meters: number): string {
  return `${meters / 1000}km`;
}

/** 18000 → "18,000원" */
export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 차액: +2,000원 / -1,000원 / 같은 가격 */
export function formatDiff(solo: number, regular: number): string {
  const d = solo - regular;
  if (d === 0) return "같은 가격";
  return `${d > 0 ? "+" : "-"}${Math.abs(d).toLocaleString("ko-KR")}원`;
}

/** 지도 마커용 짧은 가격: 18000 → "1.8만", 20000 → "2만", 9000 → "9천", 8500 → "8.5천" */
export function formatShortPrice(n: number): string {
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, "");
  if (n >= 10000) return `${trim(n / 10000)}만`;
  if (n >= 1000) return `${trim(n / 1000)}천`;
  return `${n}원`;
}

const timeFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** ISO → 한국 시간 "17:00" */
export function formatKstTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
/** ISO → "10월 29일" (올해가 아니면 "2025년 10월 29일"), 한국 날짜 기준 */
export function formatVerifiedDate(iso: string, now: Date = new Date()): string {
  const [y, m, d] = ymdFmt.format(new Date(iso)).split("-").map(Number);
  const [ny] = ymdFmt.format(now).split("-").map(Number);
  return y === ny ? `${m}월 ${d}일` : `${y}년 ${m}월 ${d}일`;
}
