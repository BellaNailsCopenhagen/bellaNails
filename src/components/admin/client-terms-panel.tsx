import { Eyebrow, BodySm } from "@/components/ui/typography"
import type { TermsAcceptance } from "@/modules/terms/acceptance"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const fmt = (iso: string) =>
  formatStudioDayMonthYear(new Date(iso).getTime(), ADMIN_LOCALE)

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <span className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
        {label}
      </span>
      <span className="font-functional text-sm text-foreground">{value}</span>
    </div>
  )
}

/**
 * What this client has accepted — service terms (at booking) and data-use terms
 * (per shared photo). Acceptances arrive newest-first, so the first service row
 * is the latest, and the data rows count the photos consented to.
 */
export function ClientTermsPanel({
  acceptances,
}: {
  acceptances: TermsAcceptance[]
}) {
  const service = acceptances.find((a) => a.kind === "service")
  const data = acceptances.filter((a) => a.kind === "data")
  const latestData = data[0]

  return (
    <section className="space-y-2">
      <Eyebrow as="h3">Terms accepted</Eyebrow>
      <div>
        <Row
          label="Service terms"
          value={
            service
              ? `v${service.version} · ${fmt(service.acceptedAt)}`
              : "Not recorded"
          }
        />
        <Row
          label="Data-use terms"
          value={
            latestData
              ? `${data.length} photo${data.length === 1 ? "" : "s"} · latest ${fmt(latestData.acceptedAt)}`
              : "Not recorded"
          }
        />
      </div>
      <BodySm className="text-[0.625rem] text-muted-foreground">
        Service terms are accepted when a session is booked; data-use terms when
        a photo is shared.
      </BodySm>
    </section>
  )
}
