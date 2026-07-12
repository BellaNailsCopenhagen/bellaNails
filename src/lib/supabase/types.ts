/**
 * Database types — generated from the live Supabase schema via the MCP
 * `generate_typescript_types` tool. Do not edit by hand; regenerate with:
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
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addon_incompatibilities: {
        Row: {
          addon_id_a: string
          addon_id_b: string
        }
        Insert: {
          addon_id_a: string
          addon_id_b: string
        }
        Update: {
          addon_id_a?: string
          addon_id_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_incompatibilities_addon_id_a_fkey"
            columns: ["addon_id_a"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_incompatibilities_addon_id_b_fkey"
            columns: ["addon_id_b"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
        ]
      }
      addons: {
        Row: {
          archived_at: string | null
          created_at: string | null
          extra_duration_mins: number
          extra_price_cents: number
          id: string
          name_dk: string
          name_en: string
          service_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          extra_duration_mins: number
          extra_price_cents: number
          id?: string
          name_dk: string
          name_en: string
          service_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          extra_duration_mins?: number
          extra_price_cents?: number
          id?: string
          name_dk?: string
          name_en?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addons_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          created_at: string | null
          id: string
          media_type: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          media_type: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          media_type?: string
          url?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          cal_booking_id: number
          cal_uid: string | null
          cancel_url: string
          clerk_user_id: string
          created_at: string | null
          end_time: string
          id: string
          reschedule_url: string
          rescheduled_from_uid: string | null
          selected_addons: Json | null
          start_time: string
          status: string
          total_price_cents: number
        }
        Insert: {
          cal_booking_id: number
          cal_uid?: string | null
          cancel_url: string
          clerk_user_id: string
          created_at?: string | null
          end_time: string
          id?: string
          reschedule_url: string
          rescheduled_from_uid?: string | null
          selected_addons?: Json | null
          start_time: string
          status: string
          total_price_cents: number
        }
        Update: {
          cal_booking_id?: number
          cal_uid?: string | null
          cancel_url?: string
          clerk_user_id?: string
          created_at?: string | null
          end_time?: string
          id?: string
          reschedule_url?: string
          rescheduled_from_uid?: string | null
          selected_addons?: Json | null
          start_time?: string
          status?: string
          total_price_cents?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived_at: string | null
          created_at: string | null
          description_dk: string | null
          description_en: string | null
          id: string
          image_url: string | null
          name_dk: string
          name_en: string
          sort_order: number | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          description_dk?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          name_dk: string
          name_en: string
          sort_order?: number | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          description_dk?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          name_dk?: string
          name_en?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          before_asset_id: string | null
          created_at: string | null
          display_mode: string
          id: string
          primary_asset_id: string | null
          sort_order: number | null
          title_dk: string | null
          title_en: string | null
        }
        Insert: {
          before_asset_id?: string | null
          created_at?: string | null
          display_mode: string
          id?: string
          primary_asset_id?: string | null
          sort_order?: number | null
          title_dk?: string | null
          title_en?: string | null
        }
        Update: {
          before_asset_id?: string | null
          created_at?: string | null
          display_mode?: string
          id?: string
          primary_asset_id?: string | null
          sort_order?: number | null
          title_dk?: string | null
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_before_asset_id_fkey"
            columns: ["before_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_items_primary_asset_id_fkey"
            columns: ["primary_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          archived_at: string | null
          base_duration_mins: number
          base_price_cents: number
          cal_event_id: number
          cal_event_slug: string | null
          category_id: string | null
          created_at: string | null
          description_dk: string | null
          description_en: string | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          name_dk: string
          name_en: string
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          base_duration_mins: number
          base_price_cents: number
          cal_event_id: number
          cal_event_slug?: string | null
          category_id?: string | null
          created_at?: string | null
          description_dk?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          name_dk: string
          name_en: string
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          base_duration_mins?: number
          base_price_cents?: number
          cal_event_id?: number
          cal_event_slug?: string | null
          category_id?: string | null
          created_at?: string | null
          description_dk?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          name_dk?: string
          name_en?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
