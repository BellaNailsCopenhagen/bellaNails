import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Container, Section } from "@/components/layout/container";
import { Eyebrow } from "@/components/ui/typography";

// Placeholder tiles — the real portfolio images are wired from `gallery_items`
// via Cloudinary in Phase 7/8. Neutral card fills keep the editorial rhythm.
function Tile() {
  return <div aria-hidden className="aspect-square bg-muted" />;
}

/**
 * StudioGallery — "The Studio". A large lead tile beside a 2×2 grid, matching
 * the comp. Images are placeholders until Cloudinary is wired.
 */
export async function StudioGallery() {
  const t = await getTranslations("studio");

  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <Link
            href="/gallery"
            className="group inline-flex items-center gap-1.5 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("viewGallery")}
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Tile />
          <div className="grid grid-cols-2 gap-2">
            <Tile />
            <Tile />
            <Tile />
            <Tile />
          </div>
        </div>
      </Container>
    </Section>
  );
}
