import Image from "next/image";
import { Show, UserButton } from "@clerk/nextjs";
import { getTranslations } from "next-intl/server";
import { MenuIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { LocaleToggle } from "@/components/locale-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        <Link href="/" className="block w-fit" aria-label="Bella Nails home">
          <Image
            src="/brand/bella-nails-horizontal.svg"
            alt="Bella Nails"
            width={224}
            height={36}
            className="h-auto w-[8.5rem] sm:w-[9.75rem]"
          />
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

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon-sm",
                    className: "lg:hidden",
                  })}
                  aria-label="Open navigation menu"
                >
                  <MenuIcon />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="lg:hidden">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("account")}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {navLinks.map((link) => (
                <DropdownMenuItem
                  key={link.href}
                  render={<Link href={link.href} className="w-full" />}
                >
                  {link.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/book" className="w-full" />}>
                {t("reserve")}
              </DropdownMenuItem>
              <Show when="signed-out">
                <DropdownMenuItem
                  render={<Link href="/sign-in" className="w-full" />}
                >
                  {t("signIn")}
                </DropdownMenuItem>
              </Show>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Container>
    </header>
  );
}
