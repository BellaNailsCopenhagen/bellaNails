import { Eyebrow, BodySm } from "@/components/ui/typography"
import { ProfileForm } from "@/components/account/profile-form"
import { DeleteAccountButton } from "@/components/account/delete-account-button"
import { SignOutButton } from "@/components/auth/sign-out-button"
import type { TermsAcceptance } from "@/modules/terms/acceptance"

const TERMS_LABEL: Record<string, string> = {
  service: "Booking terms",
  data: "Privacy & data use",
}

/** Account settings — the "gear" panel of My Space: contact details, accepted
    terms, sign out, and a separated danger zone to delete the account. */
export function AccountSettings({
  email,
  name,
  phone,
  terms,
  locale,
}: {
  email: string | null
  name: string | null
  phone: string | null
  terms: TermsAcceptance[]
  locale: string
}) {
  return (
    <div className="max-w-lg space-y-8">
      <section className="space-y-4">
        <Eyebrow as="h3">Your details</Eyebrow>
        {email ? (
          <BodySm className="text-muted-foreground">{email}</BodySm>
        ) : null}
        <ProfileForm name={name} phone={phone} />
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

      <SignOutButton />

      {/* Danger zone — set apart with space + a red frame (GitHub-style). */}
      <section className="mt-8 space-y-3 rounded-md border border-destructive/40 p-5">
        <Eyebrow as="h3" className="text-destructive">
          Danger zone
        </Eyebrow>
        <BodySm className="text-sm text-muted-foreground">
          Delete your account and personal data. Your bookings are kept as
          anonymized records.
        </BodySm>
        <DeleteAccountButton />
      </section>
    </div>
  )
}
