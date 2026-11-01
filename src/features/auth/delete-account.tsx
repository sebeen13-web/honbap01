"use client";

import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/features/auth/actions";

/** 회원 탈퇴 (확인 체크 후 실행) */
export function DeleteAccount({ ownedRestaurant, isAdmin }: { ownedRestaurant: string | null; isAdmin: boolean }) {
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isAdmin) {
    return (
      <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
        관리자 계정은 실수로 지워지지 않도록 여기서 탈퇴할 수 없어요. 먼저 DB 에서 관리자 권한을 해제해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800">
        <li>닉네임 등 프로필과 로그인 정보가 삭제돼요.</li>
        <li>즐겨찾기와 ‘오늘도 됐어요/안 됐어요’ 확인 기록이 삭제돼요.</li>
        <li>보내신 제보 내용은 남지만, 작성자 정보는 지워져요.</li>
      </ul>
      {ownedRestaurant ? (
        <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          사장님 계정이에요. 탈퇴하면 <strong>{ownedRestaurant}</strong> 식당과의 연결이 해제돼요. 식당 정보는 지도에 남고, 다시
          관리하려면 새 계정으로 ‘내 식당으로 연결 요청’을 해야 해요.
        </p>
      ) : null}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="size-5 accent-primary" />
        위 내용을 확인했고 탈퇴할게요
      </label>
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!agree || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const res = await deleteAccountAction();
              if (res && !res.ok) setError(res.message);
            } catch {
              setError("탈퇴를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
            }
          })
        }
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "탈퇴 처리 중…" : "회원 탈퇴"}
      </button>
    </div>
  );
}
