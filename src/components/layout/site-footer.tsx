import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { Eyebrow, Caption } from "@/components/ui/typography";

type FooterLink = { href: string; label: string; external?: boolean };

/**
 * SiteFooter — logo column, address column, three nav columns, and a separate
 * copyright band. `year` is passed in so the (RSC) footer stays
 * render-deterministic.
 */
export async function SiteFooter({ year }: { year: number }) {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");

  const columns: { heading: string; links: FooterLink[] }[] = [
    {
      heading: t("studio"),
      links: [
        { href: "/services", label: tNav("services") },
        { href: "/gallery", label: tNav("gallery") },
        { href: "/lookbook", label: tNav("lookbook") },
      ],
    },
    {
      heading: t("session"),
      links: [{ href: "/book", label: tNav("reserve") }],
    },
    {
      heading: t("follow"),
      links: [
        { href: "https://instagram.com", label: t("instagram"), external: true },
        { href: "https://facebook.com", label: t("facebook"), external: true },
      ],
    },
  ];

  return (
    <footer className="mt-auto bg-background">
      <Container className="grid gap-10 py-18 xs:grid-cols-2 sm:gap-6 sm:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
        <div className="text-left">
          <Link href="/" className="block w-fit" aria-label="Bella Nails home">
            <Image
              src="/brand/bella-nails-horizontal.svg"
              alt="Bella Nails"
              width={224}
              height={32}
              className="h-auto w-[10rem] sm:w-[11.25rem]"
            />
          </Link>
          <address className="font-functional ml-2 text-sm leading-8 not-italic text-foreground/80">
            Halldór Laxness Vej 3, 2. th
            <br />
            2300 København S
          </address>
        </div>

        {columns.map((col) => (
          <div key={col.heading} className="space-y-4">
            <Eyebrow className="text-[0.65rem] text-foreground/85">
              {col.heading}
            </Eyebrow>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="cursor-pointer font-functional text-[12px] font-medium tracking-[0.02em] text-primary transition-colors hover:text-primary/80"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="cursor-pointer font-functional text-[12px] font-medium tracking-[0.02em] text-primary transition-colors hover:text-primary/80"
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

      <div className="border-t border-border/70">
        <Container className="py-6">
          <Caption className="text-[0.65rem] text-foreground/80">
            © {year} Bella Nails. {t("rights")}
          </Caption>
        </Container>
      </div>
    </footer>
  );
}
