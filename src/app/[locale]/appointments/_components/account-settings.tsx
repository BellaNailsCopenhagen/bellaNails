import { Eyebrow, BodySm } from "@/components/ui/typography"
import { ProfileForm } from "@/app/[locale]/appointments/_components/profile-form"
import { DeleteAccountButton } from "@/app/[locale]/appointments/_components/delete-account-button"
import { DownloadMyDataButton } from "@/app/[locale]/appointments/_components/download-my-data-button"
import { SignOutButton } from "@/components/auth/sign-out-button"

/** Account settings — the "gear" panel of My Space: contact details, sign out,
    and a separated danger zone to delete the account. (The terms-acceptance
    record is kept server-side for compliance, not shown to the client.) */
export function AccountSettings({
  email,
  name,
  phone,
}: {
  email: string | null
  name: string | null
  phone: string | null
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

      <SignOutButton />

      <section className="space-y-3">
        <Eyebrow as="h3">Your data</Eyebrow>
        <BodySm className="text-sm text-muted-foreground">
          Download everything we hold about you — your profile, bookings,
          messages, and consent choices — as a file.
        </BodySm>
        <DownloadMyDataButton />
      </section>

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
