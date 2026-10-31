const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 한국 시간 기준 "2026. 10. 31. 오후 03:00" */
export function formatDateTime(iso: string) {
  return dateTimeFmt.format(new Date(iso));
}

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}
