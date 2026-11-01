/**
 * Supabase DB 타입.
 * supabase/migrations 의 스키마와 맞춰 둔 수기 버전이다 (자동 생성본보다 좁은 문자열 유니온·null 여부를 쓴다).
 * 스키마를 바꾼 뒤에는 아래 명령으로 자동 생성본을 만들어 비교할 수 있다:
 *   npm run db:types   (→ src/types/database.generated.ts 로 생성, 차이를 비교해 반영)
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Category = "고깃집" | "샤브샤브" | "회" | "기타";
export type TimeSlot = "all_day" | "lunch" | "dinner" | "custom";
export type PolicySource = "admin_checked" | "owner_registered";
/** user = 손님(가입 기본값), owner = 사장님(서버가 승격), admin = 관리자(DB 에서 직접 지정) */
export type Role = "user" | "owner" | "admin";
/** weekday = 월~금, weekend = 토·일, all = 매일 */
export type DayType = "weekday" | "weekend" | "all";
export type ConfirmationResult = "ok" | "not_ok";
export type ClaimStatus = "pending" | "approved" | "rejected";
export type StatKind = "view" | "directions" | "phone";

type Rel<Name extends string, Col extends string, Ref extends string, One extends boolean> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: One;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: Role; nickname: string | null; created_at: string };
        /** 가입 트리거가 만든다. 사용자는 수정할 수 없다(역할 변경 방지) */
        Insert: { id: string; role?: Role; nickname?: string | null; created_at?: string };
        Update: { role?: Role; nickname?: string | null };
        Relationships: [];
      };
      /** 즐겨찾기: 본인 것만 읽기/추가/삭제 */
      favorites: {
        Row: { user_id: string; restaurant_id: string; created_at: string };
        Insert: { user_id: string; restaurant_id: string; created_at?: string };
        Update: never;
        Relationships: [Rel<"favorites_restaurant_id_fkey", "restaurant_id", "restaurants", false>];
      };
      restaurants: {
        Row: {
          id: string;
          name: string;
          address: string;
          latitude: number;
          longitude: number;
          phone: string | null;
          category: Category;
          business_hours: Json | null;
          owner_id: string | null;
          location: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          latitude: number;
          longitude: number;
          phone?: string | null;
          category: Category;
          business_hours?: Json | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["restaurants"]["Insert"]>;
        Relationships: [];
      };
      solo_policies: {
        Row: {
          id: string;
          restaurant_id: string;
          time_slot: TimeSlot;
          time_slot_note: string | null;
          /** 보조 설명용. 화면의 추가 요금은 메뉴의 solo_price - regular_price_per_person 으로 계산한다 */
          extra_fee: boolean;
          extra_fee_note: string | null;
          is_active: boolean;
          source: PolicySource;
          last_verified_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          time_slot?: TimeSlot;
          time_slot_note?: string | null;
          extra_fee?: boolean;
          extra_fee_note?: string | null;
          is_active?: boolean;
          /** 서버 트리거가 로그인 역할에 따라 덮어쓴다 */
          source?: PolicySource;
          last_verified_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["solo_policies"]["Insert"]>;
        Relationships: [Rel<"solo_policies_restaurant_id_fkey", "restaurant_id", "restaurants", true>];
      };
      solo_menu_items: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          /** 1인분 가격(원) */
          solo_price: number;
          /** 보통(2인 이상 주문 시) 1인당 가격(원) */
          regular_price_per_person: number | null;
          /** 원래 최소 주문 인분 */
          normal_min_servings: number;
          note: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          solo_price: number;
          regular_price_per_person?: number | null;
          normal_min_servings?: number;
          note?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["solo_menu_items"]["Insert"]>;
        Relationships: [Rel<"solo_menu_items_restaurant_id_fkey", "restaurant_id", "restaurants", false>];
      };
      solo_time_rules: {
        Row: {
          id: string;
          restaurant_id: string;
          day_type: DayType;
          /** "HH:MM:SS" */
          start_time: string;
          end_time: string;
          available: boolean;
          note: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          day_type: DayType;
          start_time: string;
          end_time: string;
          available: boolean;
          note?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["solo_time_rules"]["Insert"]>;
        Relationships: [Rel<"solo_time_rules_restaurant_id_fkey", "restaurant_id", "restaurants", false>];
      };
      /**
       * 원탭 확인. 로그인 사용자가 본인 명의로 등록(같은 식당 하루 1회, 한국 날짜).
       * user_id·created_at·confirm_day 는 서버 트리거가 정한다. 행 읽기는 관리자만 (집계는 confirmation_summaries)
       * 등록할 때는 select 권한이 없으므로 결과를 돌려받지 않게(.insert(...) 만, .select() 없이) 호출한다.
       */
      solo_confirmations: {
        Row: {
          id: string;
          restaurant_id: string;
          user_id: string;
          result: ConfirmationResult;
          created_at: string;
          confirm_day: string;
        };
        Insert: { id?: string; restaurant_id: string; user_id: string; result: ConfirmationResult };
        Update: Partial<Database["public"]["Tables"]["solo_confirmations"]["Insert"]>;
        Relationships: [Rel<"solo_confirmations_restaurant_id_fkey", "restaurant_id", "restaurants", false>];
      };
      restaurant_claims: {
        Row: {
          id: string;
          restaurant_id: string;
          owner_id: string;
          status: ClaimStatus;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
        };
        Insert: { id?: string; restaurant_id: string; owner_id: string; status?: ClaimStatus; created_at?: string };
        Update: { status?: ClaimStatus };
        Relationships: [Rel<"restaurant_claims_restaurant_id_fkey", "restaurant_id", "restaurants", false>];
      };
      /** 쓰기는 increment_restaurant_stat() 로만 */
      restaurant_daily_stats: {
        Row: { restaurant_id: string; day: string; views: number; directions_clicks: number; phone_taps: number };
        Insert: never;
        Update: never;
        Relationships: [Rel<"restaurant_daily_stats_restaurant_id_fkey", "restaurant_id", "restaurants", false>];
      };
      /** 자유 텍스트 제보: 로그인 사용자만 등록(본인 명의), 읽기는 관리자만 */
      reports: {
        Row: { id: string; restaurant_id: string; reason: string; created_at: string; handled: boolean; user_id: string | null };
        Insert: { id?: string; restaurant_id: string; reason: string; user_id: string; created_at?: string; handled?: boolean };
        Update: { handled?: boolean };
        Relationships: [Rel<"reports_restaurant_id_fkey", "restaurant_id", "restaurants", false>];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      nearby_restaurants: {
        Args: { user_lat: number; user_lng: number; radius_m?: number };
        Returns: NearbyRestaurant[];
      };
      is_open_now: {
        Args: { hours: Json; at_time?: string };
        Returns: boolean | null;
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      /** 관리자 전용: 식당 + 정책 + 메뉴 + 시간대 규칙을 한 번에 등록(p_id = null) 또는 수정. 식당 id 반환 */
      admin_save_restaurant: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_address: string;
          p_latitude: number;
          p_longitude: number;
          p_phone: string | null;
          p_category: Category;
          p_business_hours: Json | null;
          p_time_slot: TimeSlot;
          p_time_slot_note: string | null;
          p_extra_fee: boolean;
          p_extra_fee_note: string | null;
          /** SoloMenuInput[] (1~10개) */
          p_menus: Json;
          /** TimeRuleInput[] (0~8개) */
          p_time_rules: Json | null;
        };
        Returns: string;
      };
      /** 식당별 확인 집계 (공개 식당 / 관리자 / 그 식당 사장님만) */
      confirmation_summaries: {
        Args: { rids: string[] };
        Returns: ConfirmationSummary[];
      };
      /** 공개 식당의 오늘 통계를 1 올린다 */
      increment_restaurant_stat: {
        Args: { p_restaurant_id: string; p_kind: StatKind };
        Returns: undefined;
      };
      /** 회원 탈퇴: 확인 기록·즐겨찾기·프로필 삭제, 사장님이면 식당 연결 해제. 관리자는 불가 */
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      solo_available_at: { Args: { rules: Json; at_time?: string }; Returns: boolean | null };
      solo_next_available_at: { Args: { rules: Json; at_time?: string }; Returns: string | null };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

/** nearby_restaurants().menus 의 한 항목 (sort_order 순) */
export type SoloMenu = {
  name: string;
  solo_price: number;
  regular_price_per_person: number | null;
  normal_min_servings: number;
  note: string | null;
  sort_order: number;
};

/** nearby_restaurants().time_rules 의 한 항목. 시각은 "HH:MM" */
export type TimeRule = {
  day_type: DayType;
  start_time: string;
  end_time: string;
  available: boolean;
  note: string | null;
};

export type ConfirmationSummary = {
  restaurant_id: string;
  ok_30d: number;
  not_ok_30d: number;
  last_ok_at: string | null;
  needs_review: boolean;
};

/** nearby_restaurants() 한 행 */
export type NearbyRestaurant = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  category: Category;
  distance_m: number;
  time_slot: TimeSlot;
  time_slot_note: string | null;
  extra_fee: boolean;
  extra_fee_note: string | null;
  source: PolicySource;
  last_verified_at: string;
  business_hours: Json | null;
  /** null = 영업시간 정보 없음 */
  is_open_now: boolean | null;
  menus: SoloMenu[];
  /** 메뉴가 없으면 null */
  min_solo_price: number | null;
  /** 메뉴 중 가장 큰 '원래 최소 인분'. 메뉴가 없으면 null */
  normal_min_servings: number | null;
  /** null = 시간대 규칙 없음(정보 없음) */
  is_solo_available_now: boolean | null;
  /** 지금 불가일 때 오늘 안에 다시 가능해지는 시각 */
  next_available_at: string | null;
  time_rules: TimeRule[];
  ok_30d: number;
  not_ok_30d: number;
  last_ok_at: string | null;
  needs_review: boolean;
};
