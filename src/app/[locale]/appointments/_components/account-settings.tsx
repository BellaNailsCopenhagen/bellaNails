import { getTranslations } from "next-intl/server"

import { DeleteAccountButton } from "@/app/[locale]/appointments/_components/delete-account-button"
import { DownloadMyDataButton } from "@/app/[locale]/appointments/_components/download-my-data-button"
import { EditProfileSheet } from "@/app/[locale]/appointments/_components/edit-profile-sheet"
import { BodySm, Eyebrow } from "@/components/ui/typography"

/**
 * Account settings — the gear panel of My Space. Three things, and they are not
 * equals: what we hold about you, the copy you can take away, and the door out.
 * So each is its own block with its own heading and one action, rather than the
 * flat run of fields, buttons and links this used to be.
 *
 * Signing out has left entirely: it is a navigation act, not a setting, and it
 * now sits above the header. (The terms-acceptance record stays server-side for
 * compliance, not shown to the client.)
 */
export async function AccountSettings({
  email,
  name,
  phone,
}: {
  email: string | null
  name: string | null
  phone: string | null
}) {
  const t = await getTranslations("account")

  const rows: { label: string; value: string | null }[] = [
    { label: t("email"), value: email },
    { label: t("name"), value: name },
    { label: t("phone"), value: phone },
  ]

  return (
    <div className="max-w-lg space-y-12">
      <section className="space-y-5">
        <div className="space-y-1">
          <Eyebrow as="h3">{t("detailsTitle")}</Eyebrow>
          <BodySm className="text-xs text-muted-foreground">
            {t("detailsIntro")}
          </BodySm>
        </div>

        <dl className="divide-y divide-border border-y border-border">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 py-3"
            >
              <dt className="font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground">
                {row.label}
              </dt>
              <dd
                className={
                  row.value
                    ? "font-functional text-sm text-foreground"
                    : "font-functional text-sm text-muted-foreground/70"
                }
              >
                {row.value || t("notSet")}
              </dd>
            </div>
          ))}
        </dl>

        {/* The email is the account's identity — changing it is a re-verification,
            not an edit, so only name and phone are offered here. */}
        <EditProfileSheet name={name} phone={phone} />
      </section>

      <section className="space-y-3">
        <Eyebrow as="h3">{t("dataTitle")}</Eyebrow>
        <BodySm className="text-xs text-muted-foreground">
          {t("dataIntro")}
        </BodySm>
        <DownloadMyDataButton />
      </section>

      {/* Danger zone — set apart with space + a red frame (GitHub-style). */}
      <section className="space-y-3 rounded-md border border-destructive/40 p-5">
        <Eyebrow as="h3" className="text-destructive">
          {t("dangerTitle")}
        </Eyebrow>
        <BodySm className="text-xs text-muted-foreground">
          {t("dangerIntro")}
        </BodySm>
        <DeleteAccountButton />
      </section>
    </div>
  )
}
