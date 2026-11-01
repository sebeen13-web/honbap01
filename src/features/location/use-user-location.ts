"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LatLng = { lat: number; lng: number };

/**
 * idle    : 아직 요청 전 (첫 진입. 권한 팝업을 띄우지 않은 상태)
 * loading : 위치를 받는 중
 * success : 위치를 받음
 * denied  : 사용자가 위치 권한을 거부함
 * error   : 그 밖의 실패 (시간 초과, 위치를 알 수 없음, 미지원 브라우저, http 접속 등)
 */
export type UserLocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; coords: LatLng; accuracyM: number }
  | { status: "denied"; message: string }
  | { status: "error"; message: string };

const OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

/**
 * 브라우저 Geolocation 으로 현재 위치를 한 번 받아 온다.
 * - request() 를 호출해야 권한을 요청한다 (마운트만으로는 팝업이 뜨지 않음).
 * - 좌표는 이 훅의 메모리 상태로만 들고 있다. 서버·localStorage 등 어디에도 저장하지 않는다.
 */
export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({ status: "idle" });
  const mounted = useRef(true);
  const pending = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const request = useCallback(() => {
    if (pending.current) return;

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setState({ status: "error", message: "이 브라우저에서는 위치 기능을 쓸 수 없어요." });
      return;
    }
    if (!window.isSecureContext) {
      setState({
        status: "error",
        message: "위치 기능은 https 주소(또는 localhost)에서만 쓸 수 있어요.",
      });
      return;
    }

    pending.current = true;
    setState({ status: "loading" });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pending.current = false;
        if (!mounted.current) return;
        setState({
          status: "success",
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracyM: pos.coords.accuracy,
        });
      },
      (err) => {
        pending.current = false;
        if (!mounted.current) return;
        if (err.code === err.PERMISSION_DENIED) {
          setState({ status: "denied", message: "위치를 허용하지 않으셨어요. 동네를 직접 검색해 보세요." });
        } else if (err.code === err.TIMEOUT) {
          setState({ status: "error", message: "위치를 확인하는 데 시간이 너무 오래 걸렸어요. 동네를 직접 검색해 보세요." });
        } else {
          setState({ status: "error", message: "현재 위치를 확인하지 못했어요. 동네를 직접 검색해 보세요." });
        }
      },
      OPTIONS,
    );
  }, []);

  return { state, request };
}
