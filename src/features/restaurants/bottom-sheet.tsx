"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type SheetSnap = "min" | "mid" | "max";
const ORDER: SheetSnap[] = ["min", "mid", "max"];
/** 손잡이를 누를 때: 접힘 → 중간 → 펼침 → 접힘 */
const cycle = (s: SheetSnap): SheetSnap => (s === "max" ? "min" : ORDER[ORDER.indexOf(s) + 1]);
const SNAP_LABEL: Record<SheetSnap, string> = { min: "접힘", mid: "중간", max: "펼침" };

function useViewportHeight() {
  const [vh, setVh] = useState(0);
  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return vh;
}

/**
 * 아래에서 올라오는 목록 시트. 높이 3단계(접힘/중간/펼침).
 * - 손잡이·제목 영역을 끌어서 높이를 바꾸고, 놓으면 가까운 단계(빠르게 튕기면 그 방향)로 붙는다.
 * - 손잡이를 누르면 다음 단계로, 위/아래 화살표 키로도 바꿀 수 있다.
 * 현재 높이(px)는 onHeightChange 로 알려 준다(지도 여백·떠 있는 버튼 위치에 사용).
 */
export function BottomSheet({
  snap,
  onSnapChange,
  topInset,
  onHeightChange,
  header,
  children,
}: {
  snap: SheetSnap;
  onSnapChange: (s: SheetSnap) => void;
  /** 펼쳤을 때 가리지 않고 남겨 둘 위쪽 높이(px) */
  topInset: number;
  onHeightChange?: (px: number) => void;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const vh = useViewportHeight();
  const headRef = useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = useState(112);
  const [dragH, setDragH] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeadH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const heights: Record<SheetSnap, number> = {
    min: headH,
    mid: Math.max(headH, Math.round(vh * 0.48)),
    max: Math.max(headH, vh - topInset),
  };
  const ready = vh > 0;
  const height = dragH ?? heights[snap];

  useEffect(() => {
    if (ready) onHeightChange?.(heights[snap]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, snap, heights.min, heights.mid, heights.max]);

  // 끌기는 window 에서 추적한다: 손가락이 시트 머리 영역을 벗어나도 계속 따라가고,
  // 그냥 누른 경우에는 손잡이 버튼의 click 이 그대로 동작한다.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    // 시트 안의 다른 버튼(반경 선택 등)은 끌기 대상이 아니다
    if (target.closest("a, input, select, button:not([data-sheet-handle])")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const onHandle = !!target.closest("[data-sheet-handle]");
    const start = { y: e.clientY, h: height, t: performance.now() };
    const h = heights;
    let moved = false;
    const clamp = (v: number) => Math.min(h.max, Math.max(h.min, v));

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const dy = ev.clientY - start.y;
      if (!moved && Math.abs(dy) < 5) return;
      moved = true;
      setDragH(clamp(start.h - dy));
    };
    const finish = (ev: PointerEvent, cancelled: boolean) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (!moved) {
        // 손잡이를 그냥 누름 → 다음 단계. (click 이벤트는 스와이프 직후 누락될 때가 있어 여기서 처리)
        if (onHandle && !cancelled) onSnapChange(cycle(snap));
        return;
      }
      setDragH(null);
      if (cancelled) return;
      const cur = clamp(start.h - (ev.clientY - start.y));
      const velocity = (start.y - ev.clientY) / Math.max(1, performance.now() - start.t); // 위로 + (px/ms)
      let next: SheetSnap;
      if (velocity > 0.5) next = ORDER.find((s) => h[s] > cur + 1) ?? "max";
      else if (velocity < -0.5) next = [...ORDER].reverse().find((s) => h[s] < cur - 1) ?? "min";
      else next = ORDER.reduce((best, s) => (Math.abs(h[s] - cur) < Math.abs(h[best] - cur) ? s : best), "min");
      onSnapChange(next);
    };
    const onUp = (ev: PointerEvent) => finish(ev, false);
    const onCancel = (ev: PointerEvent) => finish(ev, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  // 포인터 탭은 onPointerDown 쪽에서 처리하고, 여기서는 키보드(Enter/Space)로 누른 경우만 처리한다.
  function onHandleClick(e: React.MouseEvent) {
    if (e.detail !== 0) return;
    onSnapChange(cycle(snap));
  }

  function onHandleKeyDown(e: React.KeyboardEvent) {
    const i = ORDER.indexOf(snap);
    if (e.key === "ArrowUp" && i < ORDER.length - 1) {
      e.preventDefault();
      onSnapChange(ORDER[i + 1]);
    } else if (e.key === "ArrowDown" && i > 0) {
      e.preventDefault();
      onSnapChange(ORDER[i - 1]);
    }
  }

  return (
    <section
      aria-label="식당 목록"
      className={`absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-xl flex-col rounded-t-2xl bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)] ${
        dragH === null ? "transition-[height] duration-200 ease-out motion-reduce:transition-none" : ""
      }`}
      style={{ height: ready ? height : "48dvh" }}
    >
      <div
        ref={headRef}
        className="shrink-0 touch-none select-none"
        onPointerDown={onPointerDown}
      >
        <button
          type="button"
          data-sheet-handle
          onClick={onHandleClick}
          onKeyDown={onHandleKeyDown}
          aria-label={`목록 크기: ${SNAP_LABEL[snap]}. 누르거나 위·아래 화살표로 바꾸기`}
          className="flex h-7 w-full cursor-grab items-center justify-center active:cursor-grabbing"
        >
          <span className="h-1.5 w-12 rounded-full bg-gray-300" aria-hidden />
        </button>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" inert={snap === "min" && dragH === null}>
        {children}
      </div>
    </section>
  );
}
