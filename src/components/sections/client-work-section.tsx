import { Container, Section } from "@/components/layout/container"
import { SectionHeading } from "@/components/ui/section-heading"
import { ClientWorkGrid } from "@/components/sections/client-work-grid"
import type { PublicAsset } from "@/modules/media/public-assets"

/**
 * The editorial chrome around a client-work masonry — heading plus grid — shared
 * by the home showcase and the /gallery client-work section so the section
 * spacing, border, and heading tone are defined once.
 */
export function ClientWorkSection({
  eyebrow,
  lead,
  accent,
  alt,
  assets,
}: {
  eyebrow: string
  lead: string
  accent: string
  alt: string
  assets: PublicAsset[]
}) {
  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-6">
        <SectionHeading
          eyebrow={eyebrow}
          lead={lead}
          accent={accent}
          accentTone="secondary"
        />
        <ClientWorkGrid assets={assets} alt={alt} />
      </Container>
    </Section>
  )
}
