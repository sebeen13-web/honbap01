import { z } from "zod";

/**
 * 공개(브라우저 노출 가능) 환경변수.
 * NEXT_PUBLIC_* 는 빌드 시 코드에 인라인되므로 process.env.X 형태로 직접 참조해야 한다.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL 이 올바른 URL 이 아닙니다."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY 가 비어 있습니다."),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | null = null;

/** Supabase 연결에 꼭 필요한 값. 없으면 앱이 동작할 수 없으므로 오류를 던진다. */
export function getPublicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => `- ${i.message}`).join("\n");
    throw new Error(`환경변수 설정을 확인하세요 (.env.example 참고):\n${messages}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * 카카오맵 JavaScript 키. 없어도 앱은 동작하고, 지도·주소 검색 자리에 안내 문구를 보여준다.
 * 빈 문자열이나 예시 값(your-...)은 "없음"으로 취급한다.
 */
export function getKakaoAppKey(): string | null {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY?.trim();
  if (!key || key.startsWith("your-")) return null;
  return key;
}
