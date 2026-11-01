"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary w-full min-h-12">
      🖨️ 인쇄하기 (A4)
    </button>
  );
}
