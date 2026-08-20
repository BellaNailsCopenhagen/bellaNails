import Image from "next/image"
import { getTranslations } from "next-intl/server"
import { MenuIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { SignedOut } from "@/components/auth/auth-gate"
import { Container } from "@/components/layout/container"
import { LocaleToggle } from "@/components/layout/locale-toggle"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { headerNav, routes } from "@/config/routes"

/**
 * SiteHeader — sticky top bar matching the comp: wordmark, primary nav, the
 * Reserve CTA, the EN/DK toggle, and (when signed in) the account button.
 * Nav targets (`/services`, `/gallery`, `/appointments`, `/book`) are live;
 * the chrome is locale-aware.
 */
export async function SiteHeader() {
  const t = await getTranslations("nav")

  const navLinks = headerNav.map((item) => ({
    href: item.href,
    label: t(item.labelKey),
  }))

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link
          href={routes.home}
          className="block w-fit"
          aria-label="Bella Nails home"
        >
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
            render={<Link href={routes.book} />}
            className="hidden sm:inline-flex"
          >
            {t("reserve")}
          </Button>

          <SignedOut>
            <Link
              href={routes.signIn}
              className="hidden font-functional text-xs uppercase tracking-widest-lux text-foreground/80 transition-colors hover:text-foreground sm:inline"
            >
              {t("signIn")}
            </Link>
          </SignedOut>

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
              <DropdownMenuItem
                render={<Link href={routes.book} className="w-full" />}
              >
                {t("reserve")}
              </DropdownMenuItem>
              <SignedOut>
                <DropdownMenuItem
                  render={<Link href={routes.signIn} className="w-full" />}
                >
                  {t("signIn")}
                </DropdownMenuItem>
              </SignedOut>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Container>
    </header>
  )
}
