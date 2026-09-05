import type { Metadata } from "next"

import { SupabaseLoginForm } from "@/components/auth/supabase-login-form"
import { safeInternalPath } from "@/shared/safe-next"

export const metadata: Metadata = { title: "Log in" }

// Supabase Auth login (Google + email OTP). `next`/`redirect_url` = where to
// return after auth. No setRequestLocale — no translations here.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; redirect_url?: string; email?: string }>
}) {
  const { next, redirect_url, email } = await searchParams
  const safeNext = safeInternalPath(next ?? redirect_url)
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm">
        <SupabaseLoginForm next={safeNext} defaultEmail={email ?? ""} />
      </div>
    </main>
  )
}
