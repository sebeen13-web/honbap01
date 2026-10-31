"use client";

import { useFormStatus } from "react-dom";

/** 숨김/숨김 해제 폼의 제출 버튼 (처리 중 표시) */
export function ToggleActiveButton({ active, name }: { active: boolean; name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`${name} ${active ? "숨기기" : "숨김 해제"}`}
      className="btn-secondary min-h-9 py-1"
    >
      {pending ? "처리 중…" : active ? "숨김" : "숨김 해제"}
    </button>
  );
}
