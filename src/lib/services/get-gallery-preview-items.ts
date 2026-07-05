import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type GalleryPreviewItem = {
  id: string;
  display_mode: Database["public"]["Tables"]["gallery_items"]["Row"]["display_mode"];
  sort_order: number | null;
  title_en: string | null;
  title_dk: string | null;
  asset_url: string;
  asset_media_type: string;
};

type GalleryPreviewQueryRow = {
  id: string;
  display_mode: Database["public"]["Tables"]["gallery_items"]["Row"]["display_mode"];
  sort_order: number | null;
  title_en: string | null;
  title_dk: string | null;
  primary_asset:
    | {
        url: string;
        media_type: string;
      }
    | {
        url: string;
        media_type: string;
      }[]
    | null;
};

/**
 * Public gallery preview items for the home page Studio section.
 *
 * Uses the anon server client by default, but accepts an injected client so a
 * request can reuse one Supabase instance across multiple reads when needed.
 */
export async function getGalleryPreviewItems(
  supabase: SupabaseClient<Database> = createSupabaseServerClient(),
): Promise<GalleryPreviewItem[]> {
  const { data, error } = await supabase
    .from("gallery_items")
    .select(
      `id, display_mode, sort_order, title_en, title_dk, primary_asset:assets!gallery_items_primary_asset_id_fkey(url, media_type)`,
    )
    .not("sort_order", "is", null)
    .order("sort_order", { ascending: true })
    .limit(5);

  if (error) {
    throw new Error(`Failed to load gallery preview items: ${error.message}`);
  }

  return ((data ?? []) as GalleryPreviewQueryRow[])
    .map((item) => {
      const asset = Array.isArray(item.primary_asset)
        ? item.primary_asset[0]
        : item.primary_asset;

      if (!asset?.url) return null;

      return {
        id: item.id,
        display_mode: item.display_mode,
        sort_order: item.sort_order,
        title_en: item.title_en,
        title_dk: item.title_dk,
        asset_url: asset.url,
        asset_media_type: asset.media_type,
      };
    })
    .filter((item): item is GalleryPreviewItem => Boolean(item));
}

export type { GalleryPreviewItem };
