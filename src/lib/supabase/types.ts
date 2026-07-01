/**
 * Database types — hand-authored from the live Supabase schema (2026-07).
 * Mirrors the shape of `supabase gen types typescript`; regenerate with the
 * CLI once a project ref / access token is available to keep this in sync:
 *
 *   pnpm dlx supabase gen types typescript --project-id <ref> --schema public \
 *     > src/lib/supabase/types.ts
 *
 * NOTE: localized columns use the `_dk` suffix for Danish (`name_dk`,
 * `title_dk`, …) and `_en` for English — so the `da` locale maps to `_dk`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name_en: string;
          name_dk: string;
          description_en: string | null;
          description_dk: string | null;
          image_url: string | null;
          sort_order: number | null;
          created_at: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          name_en: string;
          name_dk: string;
          description_en?: string | null;
          description_dk?: string | null;
          image_url?: string | null;
          sort_order?: number | null;
          created_at?: string | null;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          name_en?: string;
          name_dk?: string;
          description_en?: string | null;
          description_dk?: string | null;
          image_url?: string | null;
          sort_order?: number | null;
          created_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          category_id: string | null;
          cal_event_id: number;
          name_en: string;
          name_dk: string;
          description_en: string | null;
          description_dk: string | null;
          base_price_cents: number;
          base_duration_mins: number;
          image_url: string | null;
          created_at: string | null;
          updated_at: string | null;
          archived_at: string | null;
          is_featured: boolean | null;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          cal_event_id: number;
          name_en: string;
          name_dk: string;
          description_en?: string | null;
          description_dk?: string | null;
          base_price_cents: number;
          base_duration_mins: number;
          image_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          archived_at?: string | null;
          is_featured?: boolean | null;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          cal_event_id?: number;
          name_en?: string;
          name_dk?: string;
          description_en?: string | null;
          description_dk?: string | null;
          base_price_cents?: number;
          base_duration_mins?: number;
          image_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          archived_at?: string | null;
          is_featured?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      addons: {
        Row: {
          id: string;
          service_id: string | null;
          name_en: string;
          name_dk: string;
          extra_price_cents: number;
          extra_duration_mins: number;
          created_at: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          service_id?: string | null;
          name_en: string;
          name_dk: string;
          extra_price_cents: number;
          extra_duration_mins: number;
          created_at?: string | null;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          service_id?: string | null;
          name_en?: string;
          name_dk?: string;
          extra_price_cents?: number;
          extra_duration_mins?: number;
          created_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "addons_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      addon_incompatibilities: {
        Row: {
          addon_id_a: string;
          addon_id_b: string;
        };
        Insert: {
          addon_id_a: string;
          addon_id_b: string;
        };
        Update: {
          addon_id_a?: string;
          addon_id_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addon_incompatibilities_addon_id_a_fkey";
            columns: ["addon_id_a"];
            isOneToOne: false;
            referencedRelation: "addons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "addon_incompatibilities_addon_id_b_fkey";
            columns: ["addon_id_b"];
            isOneToOne: false;
            referencedRelation: "addons";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          id: string;
          url: string;
          media_type: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          url: string;
          media_type: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          url?: string;
          media_type?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      gallery_items: {
        Row: {
          id: string;
          display_mode: string;
          primary_asset_id: string | null;
          before_asset_id: string | null;
          title_en: string | null;
          title_dk: string | null;
          sort_order: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          display_mode: string;
          primary_asset_id?: string | null;
          before_asset_id?: string | null;
          title_en?: string | null;
          title_dk?: string | null;
          sort_order?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          display_mode?: string;
          primary_asset_id?: string | null;
          before_asset_id?: string | null;
          title_en?: string | null;
          title_dk?: string | null;
          sort_order?: number | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gallery_items_primary_asset_id_fkey";
            columns: ["primary_asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gallery_items_before_asset_id_fkey";
            columns: ["before_asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          cal_booking_id: number;
          clerk_user_id: string;
          status: string;
          start_time: string;
          end_time: string;
          reschedule_url: string;
          cancel_url: string;
          total_price_cents: number;
          selected_addons: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          cal_booking_id: number;
          clerk_user_id: string;
          status: string;
          start_time: string;
          end_time: string;
          reschedule_url: string;
          cancel_url: string;
          total_price_cents: number;
          selected_addons?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          cal_booking_id?: number;
          clerk_user_id?: string;
          status?: string;
          start_time?: string;
          end_time?: string;
          reschedule_url?: string;
          cancel_url?: string;
          total_price_cents?: number;
          selected_addons?: Json | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// Convenience helpers — `Tables<"services">`, `TablesInsert<"bookings">`, etc.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
