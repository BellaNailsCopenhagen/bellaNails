import { Container, Section } from "@/components/layout/container"
import { PageHeader } from "@/components/ui/page-header"

/**
 * Renders a terms document (title + body) on the public /terms and /privacy
 * pages. Body is plain text: blank lines separate paragraphs, single newlines
 * are preserved within one (whitespace-pre-line) — no markdown dependency.
 */
export function TermsView({
  eyebrow,
  title,
  body,
  footnote,
}: {
  eyebrow: string
  title: string
  body: string
  footnote?: string
}) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <Section>
      <Container className="max-w-2xl space-y-8">
        <PageHeader eyebrow={eyebrow} lead={title} />
        <div className="space-y-4">
          {paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className="whitespace-pre-line font-functional text-sm leading-relaxed text-muted-foreground"
            >
              {paragraph}
            </p>
          ))}
        </div>
        {footnote ? (
          <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground/70">
            {footnote}
          </p>
        ) : null}
      </Container>
    </Section>
  )
}
