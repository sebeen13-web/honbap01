/**
 * Supabase DB 타입.
 * supabase/migrations 의 스키마와 맞춰 둔 수기 버전이다.
 * 스키마를 바꾼 뒤에는 아래 명령으로 자동 생성본을 만들어 비교할 수 있다:
 *   npm run db:types   (→ src/types/database.generated.ts 로 생성, 차이를 비교해 반영)
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Category = "고깃집" | "샤브샤브" | "회" | "기타";
export type TimeSlot = "all_day" | "lunch" | "dinner" | "custom";
export type PolicySource = "admin_checked" | "owner_registered";
export type Role = "owner" | "admin";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: Role; created_at: string };
        Insert: { id: string; role?: Role; created_at?: string };
        Update: { id?: string; role?: Role; created_at?: string };
        Relationships: [];
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
        Update: {
          id?: string;
          name?: string;
          address?: string;
          latitude?: number;
          longitude?: number;
          phone?: string | null;
          category?: Category;
          business_hours?: Json | null;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      solo_policies: {
        Row: {
          id: string;
          restaurant_id: string;
          solo_menus: string[];
          time_slot: TimeSlot;
          time_slot_note: string | null;
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
          solo_menus: string[];
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
        Update: {
          id?: string;
          restaurant_id?: string;
          solo_menus?: string[];
          time_slot?: TimeSlot;
          time_slot_note?: string | null;
          extra_fee?: boolean;
          extra_fee_note?: string | null;
          is_active?: boolean;
          source?: PolicySource;
          last_verified_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "solo_policies_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: true;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: { id: string; restaurant_id: string; reason: string; created_at: string; handled: boolean };
        Insert: { id?: string; restaurant_id: string; reason: string; created_at?: string; handled?: boolean };
        Update: { id?: string; restaurant_id?: string; reason?: string; created_at?: string; handled?: boolean };
        Relationships: [
          {
            foreignKeyName: "reports_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
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
      /** 관리자 전용: 식당 + 1인분 정책을 한 번에 등록(p_id = null) 또는 수정. 식당 id 반환 */
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
          p_solo_menus: string[];
          p_time_slot: TimeSlot;
          p_time_slot_note: string | null;
          p_extra_fee: boolean;
          p_extra_fee_note: string | null;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
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
  solo_menus: string[];
  extra_fee: boolean;
  extra_fee_note: string | null;
  source: PolicySource;
  last_verified_at: string;
  business_hours: Json | null;
  /** null = 영업시간 정보 없음 */
  is_open_now: boolean | null;
};
