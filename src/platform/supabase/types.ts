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
          cloudinary_public_id: string | null
          created_at: string | null
          id: string
          media_type: string
          storage_key: string | null
          storage_provider: string
          url: string
        }
        Insert: {
          cloudinary_public_id?: string | null
          created_at?: string | null
          id?: string
          media_type: string
          storage_key?: string | null
          storage_provider?: string
          url: string
        }
        Update: {
          cloudinary_public_id?: string | null
          created_at?: string | null
          id?: string
          media_type?: string
          storage_key?: string | null
          storage_provider?: string
          url?: string
        }
        Relationships: []
      }
      client_consents: {
        Row: {
          client_id: string
          declined_at: string | null
          granted_at: string | null
          id: string
          purpose: string
          requested_at: string
          status: string
          withdrawn_at: string | null
        }
        Insert: {
          client_id: string
          declined_at?: string | null
          granted_at?: string | null
          id?: string
          purpose: string
          requested_at?: string
          status?: string
          withdrawn_at?: string | null
        }
        Update: {
          client_id?: string
          declined_at?: string | null
          granted_at?: string | null
          id?: string
          purpose?: string
          requested_at?: string
          status?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      client_media: {
        Row: {
          archived_at: string | null
          booking_id: string | null
          caption: string | null
          client_id: string
          cloudinary_public_id: string | null
          created_at: string
          dismissed_at: string | null
          favorited_at: string | null
          id: string
          in_gallery: boolean
          is_feature: boolean
          kind: string
          service_id: string | null
          source: string
          storage_key: string | null
          storage_provider: string
          url: string
        }
        Insert: {
          archived_at?: string | null
          booking_id?: string | null
          caption?: string | null
          client_id: string
          cloudinary_public_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          favorited_at?: string | null
          id?: string
          in_gallery?: boolean
          is_feature?: boolean
          kind?: string
          service_id?: string | null
          source: string
          storage_key?: string | null
          storage_provider?: string
          url: string
        }
        Update: {
          archived_at?: string | null
          booking_id?: string | null
          caption?: string | null
          client_id?: string
          cloudinary_public_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          favorited_at?: string | null
          id?: string
          in_gallery?: boolean
          is_feature?: boolean
          kind?: string
          service_id?: string | null
          source?: string
          storage_key?: string | null
          storage_provider?: string
          url?: string
        }
        Relationships: []
      }
      media_consents: {
        Row: {
          auto_place: boolean
          client_media_id: string
          client_id: string
          declined_at: string | null
          granted_at: string | null
          id: string
          needs_takedown_at: string | null
          published_asset_id: string | null
          purpose: string
          requested_at: string
          status: string
          withdrawn_at: string | null
        }
        Insert: {
          auto_place?: boolean
          client_media_id: string
          client_id: string
          declined_at?: string | null
          granted_at?: string | null
          id?: string
          needs_takedown_at?: string | null
          published_asset_id?: string | null
          purpose: string
          requested_at?: string
          status?: string
          withdrawn_at?: string | null
        }
        Update: {
          auto_place?: boolean
          client_media_id?: string
          client_id?: string
          needs_takedown_at?: string | null
          declined_at?: string | null
          granted_at?: string | null
          id?: string
          published_asset_id?: string | null
          purpose?: string
          requested_at?: string
          status?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      asset_usages: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          surface: string
          url: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          surface: string
          url?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          surface?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_usages_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_notifications: {
        Row: {
          client_media_id: string | null
          client_id: string
          created_at: string
          id: string
          kind: string
          purpose: string | null
          read_at: string | null
        }
        Insert: {
          client_media_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          kind: string
          purpose?: string | null
          read_at?: string | null
        }
        Update: {
          client_media_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          purpose?: string | null
          read_at?: string | null
        }
        Relationships: []
      }
      booking_settings: {
        Row: {
          buffer_mins: number
          id: boolean
          max_advance_days: number
          min_lead_mins: number
          slot_interval_mins: number
          updated_at: string
        }
        Insert: {
          buffer_mins?: number
          id?: boolean
          max_advance_days?: number
          min_lead_mins?: number
          slot_interval_mins?: number
          updated_at?: string
        }
        Update: {
          buffer_mins?: number
          id?: boolean
          max_advance_days?: number
          min_lead_mins?: number
          slot_interval_mins?: number
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          cal_booking_id: number
          cal_uid: string | null
          cancel_url: string
          client_id: string
          client_notes: string | null
          created_at: string | null
          end_time: string
          id: string
          income_override_cents: number | null
          no_show_at: string | null
          reschedule_url: string
          rescheduled_from_uid: string | null
          selected_addons: Json | null
          start_time: string
          status: string
          total_price_cents: number
        }
        Insert: {
          cal_booking_id?: number | null
          cal_uid?: string | null
          cancel_url?: string | null
          client_id: string
          client_notes?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          income_override_cents?: number | null
          no_show_at?: string | null
          reschedule_url?: string | null
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
          client_id?: string
          client_notes?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          income_override_cents?: number | null
          no_show_at?: string | null
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
      service_addons: {
        Row: {
          addon_id: string
          created_at: string
          service_id: string
        }
        Insert: {
          addon_id: string
          created_at?: string
          service_id: string
        }
        Update: {
          addon_id?: string
          created_at?: string
          service_id?: string
        }
        Relationships: []
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
      price_history: {
        Row: {
          changed_at: string
          entity_id: string
          entity_type: string
          id: string
          price_cents: number
        }
        Insert: {
          changed_at?: string
          entity_id: string
          entity_type: string
          id?: string
          price_cents: number
        }
        Update: {
          changed_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          price_cents?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string | null
          body: string
          created_at: string
          id: string
          rating: number | null
          service_id: string
        }
        Insert: {
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          rating?: number | null
          service_id: string
        }
        Update: {
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          rating?: number | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_sections: {
        Row: {
          asset_id: string | null
          body_dk: string | null
          body_en: string | null
          created_at: string
          id: string
          service_id: string
          sort_order: number
          title_dk: string | null
          title_en: string | null
        }
        Insert: {
          asset_id?: string | null
          body_dk?: string | null
          body_en?: string | null
          created_at?: string
          id?: string
          service_id: string
          sort_order?: number
          title_dk?: string | null
          title_en?: string | null
        }
        Update: {
          asset_id?: string | null
          body_dk?: string | null
          body_en?: string | null
          created_at?: string
          id?: string
          service_id?: string
          sort_order?: number
          title_dk?: string | null
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_sections_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sections_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          anonymized_at: string | null
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      studio_hours: {
        Row: {
          id: boolean
          updated_at: string
          weekly: Json
        }
        Insert: {
          id?: boolean
          updated_at?: string
          weekly?: Json
        }
        Update: {
          id?: boolean
          updated_at?: string
          weekly?: Json
        }
        Relationships: []
      }
      studio_special_days: {
        Row: {
          closed: boolean
          created_at: string
          ends_on: string | null
          hours: Json | null
          id: string
          label: string | null
          starts_on: string
        }
        Insert: {
          closed?: boolean
          created_at?: string
          ends_on?: string | null
          hours?: Json | null
          id?: string
          label?: string | null
          starts_on: string
        }
        Update: {
          closed?: boolean
          created_at?: string
          ends_on?: string | null
          hours?: Json | null
          id?: string
          label?: string | null
          starts_on?: string
        }
        Relationships: []
      }
      terms: {
        Row: {
          body_dk: string | null
          body_en: string | null
          created_at: string
          id: string
          is_current: boolean
          kind: string
          title_dk: string | null
          title_en: string | null
          version: number
        }
        Insert: {
          body_dk?: string | null
          body_en?: string | null
          created_at?: string
          id?: string
          is_current?: boolean
          kind: string
          title_dk?: string | null
          title_en?: string | null
          version: number
        }
        Update: {
          body_dk?: string | null
          body_en?: string | null
          created_at?: string
          id?: string
          is_current?: boolean
          kind?: string
          title_dk?: string | null
          title_en?: string | null
          version?: number
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          client_id: string
          context: string | null
          id: string
          kind: string
          reference_id: string
          terms_id: string | null
          version: number
        }
        Insert: {
          accepted_at?: string
          client_id: string
          context?: string | null
          id?: string
          kind: string
          reference_id?: string
          terms_id?: string | null
          version: number
        }
        Update: {
          accepted_at?: string
          client_id?: string
          context?: string | null
          id?: string
          kind?: string
          reference_id?: string
          terms_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_terms_id_fkey"
            columns: ["terms_id"]
            isOneToOne: false
            referencedRelation: "terms"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
