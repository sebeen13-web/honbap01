/** 350m, 1.2km 형식 (1km 미만은 10m 단위로 반올림) */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatRadius(meters: number): string {
  return `${meters / 1000}km`;
}
