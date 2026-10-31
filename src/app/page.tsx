import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CENTER, DEFAULT_RADIUS_M, SOURCE_LABEL } from "@/lib/constants";

// 1단계 임시 화면: Supabase 연결과 nearby_restaurants 함수 동작을 확인한다.
// 3단계에서 지도 + 목록 화면으로 교체된다.
export const dynamic = "force-dynamic";

async function checkConnection() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("nearby_restaurants", {
      user_lat: DEFAULT_CENTER.lat,
      user_lng: DEFAULT_CENTER.lng,
      radius_m: DEFAULT_RADIUS_M,
    });
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, rows: data ?? [] };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : String(e) };
  }
}

export default async function Home() {
  const result = await checkConnection();

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold text-primary">혼밥 지도</h1>
      <p className="mt-1 text-sm text-gray-600">1단계 · 연결 확인 화면 (3단계에서 지도 화면으로 바뀝니다)</p>

      <section className="mt-6 rounded-xl border border-gray-200 p-4" aria-live="polite">
        {result.ok ? (
          <>
            <p className="font-semibold text-green-800">✅ Supabase 연결 성공</p>
            <p className="mt-1 text-sm text-gray-700">
              안산시청 반경 {DEFAULT_RADIUS_M / 1000}km 안 혼밥 가능 식당: <strong>{result.rows.length}곳</strong>
            </p>
            {result.rows.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600">
                아직 등록된 식당이 없어요. 로컬이라면 <code>npx supabase db reset</code>으로 샘플 데이터를 넣어 보세요.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100">
                {result.rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {r.name} <span className="text-gray-500">· {r.category}</span>
                    </span>
                    <span className="shrink-0 text-gray-600">
                      {(r.distance_m / 1000).toFixed(1)}km ·{" "}
                      <span className="rounded bg-primary-soft px-1.5 py-0.5 text-primary-strong">
                        {SOURCE_LABEL[r.source]}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="font-semibold text-red-700">⚠️ 연결 실패</p>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-gray-700">{result.message}</pre>
            <p className="mt-3 text-sm text-gray-600">
              <code>.env.local</code> 값과 마이그레이션 적용 여부를 확인하세요.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
