import { Show, UserButton } from "@clerk/nextjs";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { LocaleToggle } from "@/components/locale-toggle";
import { Button } from "@/components/ui/button";

/**
 * SiteHeader — sticky top bar matching the comp: wordmark, primary nav, the
 * Reserve CTA, the EN/DK toggle, and (when signed in) the account button.
 * Nav targets (`/services`, `/gallery`, `/lookbook`, `/bookings`, `/book`)
 * come online across Phases 6–7; the chrome is locale-aware now.
 */
export async function SiteHeader() {
  const t = await getTranslations("nav");

  const navLinks = [
    { href: "/services", label: t("services") },
    { href: "/gallery", label: t("gallery") },
    { href: "/lookbook", label: t("lookbook") },
    { href: "/bookings", label: t("bookings") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="font-editorial text-2xl tracking-tightest text-foreground"
        >
          Bella Nails
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-functional text-xs uppercase tracking-widest-lux text-foreground/80 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/book" />}
            className="hidden sm:inline-flex"
          >
            {t("reserve")}
          </Button>

          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="hidden font-functional text-xs uppercase tracking-widest-lux text-foreground/80 transition-colors hover:text-foreground sm:inline"
            >
              {t("signIn")}
            </Link>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>

          <LocaleToggle />
        </div>
      </Container>
    </header>
  );
}
