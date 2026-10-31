"use client";

import type { KakaoNamespace } from "@/features/map/kakao-types";

const SCRIPT_ID = "kakao-maps-sdk";
let loading: Promise<KakaoNamespace> | null = null;

/**
 * 카카오맵 JS SDK(services 라이브러리 포함)를 한 번만 불러온다.
 * autoload=false 로 불러온 뒤 kakao.maps.load() 로 초기화한다.
 * 실패 원인 대부분: 키 오류, 카카오 콘솔의 [Web 사이트 도메인]에 현재 주소 미등록, 카카오맵 API 사용 설정 꺼짐.
 */
export function loadKakaoSdk(appKey: string): Promise<KakaoNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저에서만 사용할 수 있어요."));
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao);
  if (loading) return loading;

  loading = new Promise<KakaoNamespace>((resolve, reject) => {
    const fail = (message: string) => {
      loading = null;
      document.getElementById(SCRIPT_ID)?.remove();
      reject(new Error(message));
    };
    const timer = window.setTimeout(() => fail("카카오 지도 SDK 응답이 없어요."), 10000);

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
    script.onload = () => {
      const kakao = window.kakao;
      if (!kakao?.maps) {
        window.clearTimeout(timer);
        fail("카카오 지도 SDK를 초기화하지 못했어요.");
        return;
      }
      kakao.maps.load(() => {
        window.clearTimeout(timer);
        resolve(kakao);
      });
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      fail("카카오 지도 SDK를 불러오지 못했어요.");
    };
    document.head.appendChild(script);
  });

  return loading;
}
