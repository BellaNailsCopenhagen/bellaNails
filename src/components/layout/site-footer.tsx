import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { Eyebrow, Caption } from "@/components/ui/typography";

type FooterLink = { href: string; label: string; external?: boolean };

/**
 * SiteFooter — logo column, address column, three nav columns, and a separate
 * copyright band. The year is derived server-side so it stays current without
 * manual maintenance.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const year = new Date().getFullYear();

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
    <footer className="mt-auto border-t border-background/10 bg-primary text-primary-foreground">
      <Container className="grid gap-10 py-18 xs:grid-cols-2 sm:gap-6 sm:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
        <div className="text-left">
          <Link href="/" className="block w-fit" aria-label="Bella Nails home">
            <Image
              src="/brand/bella-nails-horizontal-reverse.svg"
              alt="Bella Nails"
              width={224}
              height={32}
              className="h-auto w-[10rem] sm:w-[11.25rem]"
            />
          </Link>
          <address className="font-functional ml-2 text-sm leading-8 not-italic text-primary-foreground/72">
            Halldór Laxness Vej 3, 2. th
            <br />
            2300 København S
          </address>
        </div>

        {columns.map((col) => (
          <div key={col.heading} className="space-y-4">
            <Eyebrow className="text-[0.65rem] text-primary-foreground/65">
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
                      className="cursor-pointer font-functional text-[12px] font-medium tracking-[0.02em] text-primary-foreground/82 transition-colors hover:text-primary-foreground"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="cursor-pointer font-functional text-[12px] font-medium tracking-[0.02em] text-primary-foreground/82 transition-colors hover:text-primary-foreground"
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

      <div className="border-t border-primary-foreground/12">
        <Container className="py-6">
          <Caption className="text-[0.65rem] text-primary-foreground/65">
            © {year} Bella Nails. {t("rights")}
          </Caption>
        </Container>
      </div>
    </footer>
  );
}
