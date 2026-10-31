/** 카카오맵 JS SDK 중 이 앱이 쓰는 부분만 최소한으로 타입을 선언한다. */

export type KakaoStatus = "OK" | "ZERO_RESULT" | "ERROR";

export type KakaoAddressResult = {
  address_name: string;
  x: string; // 경도
  y: string; // 위도
  address_type: "REGION" | "ROAD" | "REGION_ADDR" | "ROAD_ADDR";
  road_address: { address_name: string; building_name?: string } | null;
  address: { address_name: string } | null;
};

export type KakaoPlaceResult = {
  id: string;
  place_name: string;
  category_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
};

export type KakaoNamespace = {
  maps: {
    load: (callback: () => void) => void;
    services: {
      Status: Record<KakaoStatus, KakaoStatus>;
      Geocoder: new () => {
        addressSearch: (
          query: string,
          callback: (result: KakaoAddressResult[], status: KakaoStatus) => void,
          options?: { size?: number },
        ) => void;
      };
      Places: new () => {
        keywordSearch: (
          query: string,
          callback: (result: KakaoPlaceResult[], status: KakaoStatus) => void,
          options?: { size?: number },
        ) => void;
      };
    };
  };
};

declare global {
  interface Window {
    kakao?: KakaoNamespace;
  }
}
