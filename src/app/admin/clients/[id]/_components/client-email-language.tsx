"use client"

import type { Locale } from "@/i18n/routing"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { useActionRunner } from "@/hooks/use-action-runner"
import { setClientCommunicationLocale } from "@/modules/clients/actions"

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "da", label: "Dansk" },
  { locale: "en", label: "English" },
]

/**
 * Owner control for the language a client's transactional emails are sent in —
 * booking confirmations and cancel/reschedule notices. Defaults to Danish.
 */
export function ClientEmailLanguage({
  clientId,
  locale,
}: {
  clientId: string
  locale: Locale
}) {
  const { pending, run } = useActionRunner()

  return (
    <section className="space-y-2">
      <Eyebrow as="h3">Email language</Eyebrow>
      <div className="flex gap-2">
        {OPTIONS.map((option) => {
          const active = option.locale === locale
          return (
            <button
              key={option.locale}
              type="button"
              // The active choice needs no re-write; block it while one is in flight.
              disabled={pending || active}
              aria-pressed={active}
              onClick={() =>
                run(() => setClientCommunicationLocale(clientId, option.locale))
              }
              className={`border px-3 py-1.5 font-functional text-xs uppercase tracking-widest-lux transition-colors ${
                active
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <BodySm className="text-[0.625rem] text-muted-foreground">
        Transactional emails to this client are sent in this language.
      </BodySm>
    </section>
  )
}
