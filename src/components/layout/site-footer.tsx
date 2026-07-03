import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { Eyebrow, Body, Caption } from "@/components/ui/typography";

type FooterLink = { href: string; label: string; external?: boolean };

/**
 * SiteFooter — closing band matching the comp: brand block + tagline + address,
 * three link columns (Studio / Explore / Social), and the fine print. `year`
 * is passed in so the (RSC) footer stays render-deterministic.
 */
export async function SiteFooter({ year }: { year: number }) {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");

  const columns: { heading: string; links: FooterLink[] }[] = [
    {
      heading: t("studio"),
      links: [
        { href: "/about", label: t("about") },
        { href: "/find-us", label: t("findUs") },
      ],
    },
    {
      heading: t("explore"),
      links: [
        { href: "/services", label: tNav("services") },
        { href: "/gallery", label: tNav("gallery") },
        { href: "/lookbook", label: tNav("lookbook") },
      ],
    },
    {
      heading: t("social"),
      links: [
        { href: "https://instagram.com", label: t("instagram"), external: true },
        { href: "https://facebook.com", label: t("facebook"), external: true },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-border bg-card">
      <Container className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Link
            href="/"
            className="font-editorial text-2xl tracking-tightest text-foreground"
          >
            Bella Nails
          </Link>
          <Body className="max-w-xs text-sm text-muted-foreground">
            {t("tagline")}
          </Body>
          <address className="font-functional text-sm not-italic text-muted-foreground">
            Halldór Laxness Vej 3, 2. th
            <br />
            2300 København S
          </address>
        </div>

        {columns.map((col) => (
          <div key={col.heading} className="space-y-4">
            <Eyebrow className="text-[0.65rem]">{col.heading}</Eyebrow>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="font-functional text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="font-functional text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-border/60">
        <Container className="py-6">
          <Caption className="text-[0.65rem]">
            © {year} Bella Nails · {t("rights")}
          </Caption>
        </Container>
      </div>
    </footer>
  );
}
