import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type GalleryPreviewItem = {
  id: string;
  title_en: string | null;
  title_dk: string | null;
  asset_url: string;
};

// Supabase types a foreign-key join as the related row *or* an array of them
// depending on the relationship shape, so the joined asset is normalized below.
type GalleryPreviewQueryRow = {
  id: string;
  title_en: string | null;
  title_dk: string | null;
  primary_asset: { url: string } | { url: string }[] | null;
};

/**
 * Featured gallery items for the home-page Studio section, ordered by their
 * `sort_order` slot (1–5). Only items assigned a slot are returned.
 *
 * Defaults to the anon server client (the standard RSC pattern) but accepts an
 * injected client so a request can reuse one instance across several reads.
 */
export async function getGalleryPreviewItems(
  supabase: SupabaseClient<Database> = createSupabaseServerClient(),
): Promise<GalleryPreviewItem[]> {
  const { data, error } = await supabase
    .from("gallery_items")
    .select(
      "id, title_en, title_dk, primary_asset:assets!gallery_items_primary_asset_id_fkey(url)",
    )
    .not("sort_order", "is", null)
    .order("sort_order", { ascending: true })
    .limit(5);

  if (error) {
    throw new Error(`Failed to load gallery preview items: ${error.message}`);
  }

  return ((data ?? []) as GalleryPreviewQueryRow[]).flatMap((row) => {
    const asset = Array.isArray(row.primary_asset)
      ? row.primary_asset[0]
      : row.primary_asset;

    if (!asset?.url) return [];

    return [
      {
        id: row.id,
        title_en: row.title_en,
        title_dk: row.title_dk,
        asset_url: asset.url,
      },
    ];
  });
}

export type { GalleryPreviewItem };
