import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ConfirmationSummary } from "@/types/database";

/**
 * "오늘도 됐어요 / 안 됐어요" 등록 (로그인 사용자, 같은 식당 하루 1회 — 한국 날짜, user_id 기준).
 * 위치는 받지 않는다. 리뷰 글도 받지 않는다(결과 ok / not_ok 만).
 *
 * 응답
 *  200 { ok: true, summary }                      등록 + 갱신된 집계
 *  401 { ok: false, code: "login" }               로그인 필요
 *  409 { ok: false, code: "already", summary }    오늘 이미 확인함
 *  403 { ok: false, code: "hidden" }              공개 중이 아닌 식당
 *  400 { ok: false, code: "invalid" }
 */
export type ConfirmResponse =
  | { ok: true; summary: ConfirmationSummary | null }
  | { ok: false; code: "login" | "already" | "hidden" | "invalid" | "error"; message: string; summary?: ConfirmationSummary | null };

const bodySchema = z.object({ result: z.enum(["ok", "not_ok"]) });

function json(body: ConfirmResponse, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 다른 사이트에서 보낸 요청 차단 (쿠키 SameSite=Lax 와 함께 이중 방어)
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return json({ ok: false, code: "invalid", message: "잘못된 요청이에요." }, 403);
  }

  const { id } = await params;
  if (!z.guid().safeParse(id).success) return json({ ok: false, code: "invalid", message: "잘못된 식당이에요." }, 400);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, code: "invalid", message: "잘못된 요청이에요." }, 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ ok: false, code: "login", message: "로그인하면 확인을 남길 수 있어요." }, 401);

  const summary = async () => {
    const { data } = await supabase.rpc("confirmation_summaries", { rids: [id] });
    return data?.[0] ?? null;
  };

  // user_id·시각·날짜는 DB 트리거가 서버 값으로 정한다. select 권한이 없으므로 결과는 돌려받지 않는다.
  const { error } = await supabase.from("solo_confirmations").insert({ restaurant_id: id, user_id: user.id, result: parsed.data.result });
  if (error) {
    if (error.code === "23505") {
      return json({ ok: false, code: "already", message: "오늘은 이미 확인을 남겼어요. 내일 다시 남길 수 있어요.", summary: await summary() }, 409);
    }
    if (error.code === "42501") {
      return json({ ok: false, code: "hidden", message: "지금은 확인을 남길 수 없는 식당이에요." }, 403);
    }
    console.error("[confirm]", error.code, error.message);
    return json({ ok: false, code: "error", message: "확인을 남기지 못했어요. 잠시 후 다시 시도해 주세요." }, 500);
  }
  return json({ ok: true, summary: await summary() }, 200);
}
