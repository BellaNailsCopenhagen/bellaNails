import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { LocaleToggle } from "@/components/locale-toggle";
import { AuthControls } from "@/components/auth-controls";
import { Button } from "@/components/ui/button";

/**
 * SiteHeader — sticky top bar: wordmark, primary nav, locale toggle, auth
 * controls, and the booking CTA. Nav targets (`/services`, `/gallery`,
 * `/book`) come online in Phases 6–7; the header itself is locale-aware now.
 */
export async function SiteHeader() {
  const t = await getTranslations("nav");

  const navLinks = [
    { href: "/services", label: t("services") },
    { href: "/gallery", label: t("gallery") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="font-editorial text-xl tracking-tightest text-foreground"
        >
          Bella Nails
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-functional text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <LocaleToggle />
          <Button
            size="sm"
            className="hidden sm:inline-flex"
            render={<Link href="/book" />}
          >
            {t("book")}
          </Button>
          <AuthControls signInLabel={t("signIn")} signUpLabel={t("signUp")} />
        </div>
      </Container>
    </header>
  );
}
