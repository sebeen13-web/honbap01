import Link from "next/link";

export default function RestaurantNotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-4xl" aria-hidden>
        🍽️
      </p>
      <h1 className="mt-3 text-xl font-bold text-gray-900">식당을 찾을 수 없어요</h1>
      <p className="mt-2 text-sm text-gray-700">지금은 숨김·일시중단 상태이거나 삭제된 식당이에요.</p>
      <div className="mt-6 grid gap-2">
        <Link href="/map" className="btn-primary">
          지도에서 다른 식당 보기
        </Link>
        <Link href="/" className="btn-secondary">
          홈으로
        </Link>
      </div>
    </main>
  );
}
