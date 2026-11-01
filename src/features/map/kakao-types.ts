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

export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoPoint {
  x: number;
  y: number;
}

export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
}

export interface KakaoProjection {
  pointFromCoords(latlng: KakaoLatLng): KakaoPoint;
  coordsFromPoint(point: KakaoPoint): KakaoLatLng;
}

export interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void;
  getCenter(): KakaoLatLng;
  panTo(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  getLevel(): number;
  /** 여백(px) 순서: 위, 오른쪽, 아래, 왼쪽 */
  setBounds(bounds: KakaoLatLngBounds, top?: number, right?: number, bottom?: number, left?: number): void;
  relayout(): void;
  getProjection(): KakaoProjection;
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void;
  setZIndex(z: number): void;
  setPosition(latlng: KakaoLatLng): void;
}

export interface KakaoCircle {
  setMap(map: KakaoMap | null): void;
  setPosition(latlng: KakaoLatLng): void;
  setRadius(radius: number): void;
}

export type KakaoNamespace = {
  maps: {
    load: (callback: () => void) => void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Point: new (x: number, y: number) => KakaoPoint;
    LatLngBounds: new (sw?: KakaoLatLng, ne?: KakaoLatLng) => KakaoLatLngBounds;
    Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
    CustomOverlay: new (options: {
      position: KakaoLatLng;
      content: HTMLElement | string;
      xAnchor?: number;
      yAnchor?: number;
      zIndex?: number;
      clickable?: boolean;
    }) => KakaoCustomOverlay;
    Circle: new (options: {
      center: KakaoLatLng;
      radius: number;
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: string;
      fillColor?: string;
      fillOpacity?: number;
    }) => KakaoCircle;
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
