import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

// Plain next/link, not the locale-aware one: `next` already carries its
// locale prefix, and i18n/navigation would add a second.
import Link from "next/link"
import { SupabaseLoginForm } from "@/components/auth/supabase-login-form"
import { Button } from "@/components/ui/button"
import { BodySm, H3 } from "@/components/ui/typography"
import { getCurrentUser } from "@/modules/identity/server"
import { resolveLocale, routing } from "@/i18n/routing"
import { safeInternalPath } from "@/shared/safe-next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "login" })
  return {
    title: t("metaTitle"),
    // Nothing to rank, and a signed-in-only destination beyond it.
    robots: { index: false, follow: true },
  }
}

// Supabase Auth login (Google + email OTP). `next`/`redirect_url` = where to
// return after auth.
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    next?: string
    redirect_url?: string
    email?: string
    error?: string
  }>
}) {
  const [{ locale }, { next: nextParam, redirect_url, email, error }] = await Promise.all([
    params,
    searchParams,
  ])
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations("login")

  // Land back in the locale they signed in from — "/" would re-negotiate it
  // from Accept-Language and can flip a Danish sign-in to English.
  const home = `/${resolveLocale(locale)}`
  const next = safeInternalPath(nextParam ?? redirect_url, home)

  // A signed-in visitor used to get the full form with no hint that they were
  // already in. Not a redirect: arriving here deliberately usually means
  // signing in as someone else, so say where they stand and leave the form.
  const user = await getCurrentUser()

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm space-y-6">
        {user ? (
          <div className="space-y-3 rounded-sm border border-border p-4">
            <H3>{t("alreadyTitle")}</H3>
            <BodySm className="text-xs">
              {t("alreadyBody", { email: user.email ?? "" })}
            </BodySm>
            <Button
              nativeButton={false}
              size="sm"
              render={<Link href={next} />}
            >
              {t("alreadyContinue")}
            </Button>
          </div>
        ) : null}
        {/* /api/auth/callback sends OAuth failures here with ?error=auth. It
            was read by nobody, so a failed Google sign-in showed a blank form
            and no explanation. */}
        {error === "auth" ? (
          <BodySm className="text-xs text-destructive">
            {t("oauthFailed")}
          </BodySm>
        ) : null}
        <SupabaseLoginForm next={next} defaultEmail={email ?? ""} />
      </div>
    </main>
  )
}
