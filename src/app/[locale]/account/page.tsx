import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { AccountTabs } from "@/components/account/account-tabs"
import { DeleteAccountButton } from "@/components/account/delete-account-button"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { getCurrentUser } from "@/lib/identity/server"
import { getTermsAcceptances } from "@/lib/terms-acceptance"
import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "My space" }
export const dynamic = "force-dynamic"

/** The client's own account: details (name/phone) + accepted terms in a tabbed
    panel, sign out, and a separated danger zone to delete the account. Signed-in
    only (also gated by the proxy). */
export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/login`)

  const supabase = await createAuthedSupabaseServerClient()
  const [{ data: profile }, terms] = await Promise.all([
    supabase
      .from("clients")
      .select("name, phone, email")
      .eq("id", user.id)
      .maybeSingle(),
    getTermsAcceptances(supabase, user.id).catch(() => []),
  ])

  return (
    <main className="mx-auto w-full max-w-lg space-y-8 px-6 py-16">
      <div className="space-y-1">
        <Eyebrow>Account</Eyebrow>
        <H2>My space</H2>
        {profile?.email ? (
          <BodySm className="text-muted-foreground">{profile.email}</BodySm>
        ) : null}
      </div>

      <AccountTabs
        name={profile?.name ?? null}
        phone={profile?.phone ?? null}
        terms={terms}
        locale={locale}
      />

      <SignOutButton />

      {/* Danger zone — set apart with space + a red frame (GitHub-style). */}
      <section className="mt-16 space-y-3 rounded-md border border-destructive/40 p-5">
        <Eyebrow as="h3" className="text-destructive">
          Danger zone
        </Eyebrow>
        <BodySm className="text-sm text-muted-foreground">
          Delete your account and personal data. Your bookings are kept as
          anonymized records.
        </BodySm>
        <DeleteAccountButton />
      </section>
    </main>
  )
}
