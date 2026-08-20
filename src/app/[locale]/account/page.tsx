import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { ProfileForm } from "@/components/account/profile-form"
import { AccountActions } from "@/components/account/account-actions"
import { getCurrentUser } from "@/lib/identity/server"
import { getTermsAcceptances } from "@/lib/terms-acceptance"
import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "My space" }
export const dynamic = "force-dynamic"

const SUPPORT_EMAIL = "booking@bellanails.dk"
const TERMS_LABEL: Record<string, string> = {
  service: "Booking terms",
  data: "Privacy & data use",
}

/** The client's own account: edit contact details, see accepted terms, get help,
    sign out, or delete the account. Signed-in only (also gated by the proxy). */
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
    <main className="mx-auto w-full max-w-lg space-y-12 px-6 py-16">
      <div className="space-y-1">
        <Eyebrow>Account</Eyebrow>
        <H2>My space</H2>
        {profile?.email ? (
          <BodySm className="text-sm text-muted-foreground">{profile.email}</BodySm>
        ) : null}
      </div>

      <section className="space-y-4">
        <Eyebrow as="h3">Your details</Eyebrow>
        <ProfileForm name={profile?.name ?? null} phone={profile?.phone ?? null} />
      </section>

      {terms.length ? (
        <section className="space-y-3">
          <Eyebrow as="h3">Accepted terms</Eyebrow>
          <ul className="space-y-2">
            {terms.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 font-functional text-sm"
              >
                <span className="text-foreground">
                  {TERMS_LABEL[t.kind] ?? t.kind}
                </span>
                <span className="text-xs text-muted-foreground">
                  v{t.version} · {new Date(t.acceptedAt).toLocaleDateString(locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <Eyebrow as="h3">Help</Eyebrow>
        <div className="flex flex-col gap-2 font-functional text-sm">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Contact support
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Bug%20report`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Report a bug
          </a>
        </div>
      </section>

      <section className="border-t border-border pt-6">
        <AccountActions />
      </section>
    </main>
  )
}
