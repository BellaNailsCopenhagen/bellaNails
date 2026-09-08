import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { SupabaseLoginForm } from "@/components/auth/supabase-login-form"
import { BodySm } from "@/components/ui/typography"
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
  const [{ locale }, { next, redirect_url, email, error }] = await Promise.all([
    params,
    searchParams,
  ])
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations("login")

  // Land back in the locale they signed in from — "/" would re-negotiate it
  // from Accept-Language and can flip a Danish sign-in to English.
  const home = `/${resolveLocale(locale)}`
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm space-y-6">
        {/* /api/auth/callback sends OAuth failures here with ?error=auth. It
            was read by nobody, so a failed Google sign-in showed a blank form
            and no explanation. */}
        {error === "auth" ? (
          <BodySm className="text-xs text-destructive">
            {t("oauthFailed")}
          </BodySm>
        ) : null}
        <SupabaseLoginForm
          next={safeInternalPath(next ?? redirect_url, home)}
          defaultEmail={email ?? ""}
        />
      </div>
    </main>
  )
}
