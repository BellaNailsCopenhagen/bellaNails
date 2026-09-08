import type { Metadata } from "next"

import { SupabaseLoginForm } from "@/components/auth/supabase-login-form"
import { resolveLocale } from "@/i18n/routing"
import { safeInternalPath } from "@/shared/safe-next"

export const metadata: Metadata = { title: "Log in" }

// Supabase Auth login (Google + email OTP). `next`/`redirect_url` = where to
// return after auth. No setRequestLocale — no translations here.
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string; redirect_url?: string; email?: string }>
}) {
  const [{ locale }, { next, redirect_url, email }] = await Promise.all([
    params,
    searchParams,
  ])
  // Land back in the locale they signed in from — "/" would re-negotiate it
  // from Accept-Language and can flip a Danish sign-in to English.
  const home = `/${resolveLocale(locale)}`
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm">
        <SupabaseLoginForm
          next={safeInternalPath(next ?? redirect_url, home)}
          defaultEmail={email ?? ""}
        />
      </div>
    </main>
  )
}
