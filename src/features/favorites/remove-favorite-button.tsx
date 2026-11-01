"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function RemoveFavoriteButton({ restaurantId, name }: { restaurantId: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        aria-label={`${name} 즐겨찾기에서 빼기`}
        className="btn-secondary min-h-11 px-3"
        onClick={async () => {
          setPending(true);
          setError(false);
          const supabase = createClient();
          const { error } = await supabase.from("favorites").delete().eq("restaurant_id", restaurantId);
          setPending(false);
          if (error) setError(true);
          else router.refresh();
        }}
      >
        {pending ? "빼는 중…" : "빼기"}
      </button>
      {error ? <p className="field-error">다시 시도해 주세요</p> : null}
    </div>
  );
}
