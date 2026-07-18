"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"

import { Container, Section } from "@/components/layout/container"
import { ErrorState } from "@/components/ui/error-state"
import { ArrowLink } from "@/components/ui/arrow-link"
import { Button } from "@/components/ui/button"
import { routes } from "@/config/routes"

/**
 * Localized error boundary for the `[locale]` subtree. Catches unexpected
 * runtime errors thrown below the locale layout and renders the shared branded
 * ErrorState with a retry (Next 16.2's `unstable_retry` re-runs the failed
 * segment) and a home escape. It renders inside `[locale]/layout.tsx`, so the
 * header/footer and the active locale's translations stay in place.
 *
 * Error boundaries must be Client Components — hence `useTranslations`, not the
 * server `getTranslations`. Errors thrown in the layout itself are caught one
 * level up by `app/global-error.tsx`.
 */
export default function LocaleError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const t = useTranslations("errors")

  useEffect(() => {
    // Server Component errors arrive with only a `digest` (message stripped in
    // production); log it so it can be matched against the server-side entry.
    console.error(error)
  }, [error])

  return (
    <main className="flex flex-1 flex-col">
      <Section>
        <Container className="max-w-4xl">
          <ErrorState
            eyebrow={t("eyebrow")}
            title={t("title")}
            body={t("body")}
          >
            <Button onClick={() => unstable_retry()}>{t("retry")}</Button>
            <ArrowLink href={routes.home}>{t("backHome")}</ArrowLink>
          </ErrorState>
        </Container>
      </Section>
    </main>
  )
}
