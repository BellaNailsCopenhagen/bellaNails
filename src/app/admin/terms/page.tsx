import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { TermsEditor } from "@/components/admin/terms-editor"
import { createSupabaseServerClient } from "@/platform/supabase/server"
import { getTermsVersions, TERMS_KINDS } from "@/modules/terms/terms"

export const metadata: Metadata = { title: "Terms" }
export const dynamic = "force-dynamic"

const KIND_LABEL: Record<(typeof TERMS_KINDS)[number], string> = {
  service: "Service terms",
  data: "Data-use terms",
}

/**
 * Manage the two terms documents (service + data-use). Owner-gated by the proxy.
 * Editing publishes a new version; clients on the public pages always see the
 * current one, and acceptances keep pointing at the version they agreed to.
 */
export default async function AdminTermsPage() {
  const supabase = createSupabaseServerClient()
  const kinds = await Promise.all(
    TERMS_KINDS.map(async (kind) => {
      const versions = await getTermsVersions(kind, supabase)
      return {
        kind,
        current: versions.find((v) => v.isCurrent) ?? null,
        versions,
      }
    }),
  )

  return (
    <div className="space-y-6">
      <Link
        href="/admin/more"
        className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        More
      </Link>

      <div className="space-y-1">
        <Eyebrow>Studio</Eyebrow>
        <H2>Terms</H2>
        <BodySm className="text-xs">
          Booking terms and the data-use / privacy notice, shown on /terms and
          /privacy and referenced in the booking flow.
        </BodySm>
      </div>

      <div className="space-y-4">
        {kinds.map(({ kind, current, versions }) => (
          <TermsEditor
            key={kind}
            kind={kind}
            label={KIND_LABEL[kind]}
            current={current}
            versions={versions}
          />
        ))}
      </div>
    </div>
  )
}
