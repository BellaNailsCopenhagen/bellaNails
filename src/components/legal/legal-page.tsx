import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { routing } from "@/i18n/routing"
import { alternatesFor } from "@/config/site"
import { routes } from "@/config/routes"
import { TermsView } from "@/components/legal/terms-view"
import { getCurrentTerms, localizeTerms, type TermsKind } from "@/modules/terms/terms"
import { formatStudioDayMonthYear } from "@/shared/studio-time"

// The terms `kind` doubles as the `legal` message subkey (service.* / data.*),
// so /terms and /privacy share this one implementation.

export async function legalMetadata(
  locale: string,
  kind: TermsKind,
): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "legal" })
  return {
    title: t(`${kind}.metaTitle`),
    description: t(`${kind}.metaDescription`),
    alternates: alternatesFor(
      locale,
      kind === "service" ? routes.terms : routes.privacy,
    ),
  }
}

/** Public legal page — renders the current version of a terms `kind`. */
export async function LegalPage({
  locale,
  kind,
}: {
  locale: string
  kind: TermsKind
}) {
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations("legal")
  const record = await getCurrentTerms(kind)
  const terms = record ? localizeTerms(record, locale) : null

  return (
    <main className="flex flex-1 flex-col">
      <TermsView
        eyebrow={t("eyebrow")}
        title={terms?.title || t(`${kind}.fallbackTitle`)}
        body={terms?.body || t(`${kind}.fallbackBody`)}
        footnote={
          record
            ? t("updated", {
                date: formatStudioDayMonthYear(
                  new Date(record.createdAt).getTime(),
                  locale,
                ),
              })
            : undefined
        }
      />
    </main>
  )
}
