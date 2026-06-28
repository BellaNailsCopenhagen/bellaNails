import type { Metadata } from "next";

import {
  Display,
  H1,
  H2,
  H3,
  HeadingLine,
  HeadingAccent,
  HeadingMuted,
  Eyebrow,
  Lead,
  Body,
  BodySm,
  Quote,
  Caption,
} from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Typography",
  robots: { index: false, follow: false },
};

function Row({
  name,
  spec,
  children,
}: {
  name: string;
  spec: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-t border-border py-10 sm:grid-cols-[10rem_1fr] sm:gap-8">
      <div className="flex flex-col gap-1">
        <Caption>{name}</Caption>
        <BodySm className="text-xs">{spec}</BodySm>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-28">
      <Eyebrow>Design System</Eyebrow>
      <H1 className="mt-4">
        <HeadingLine>Typography</HeadingLine>
        <HeadingAccent>scale</HeadingAccent>
      </H1>
      <Lead className="mt-5 max-w-xl">
        The Bella Nails type system — Cormorant Garamond for editorial voice,
        Plus Jakarta Sans for everything functional.
      </Lead>

      <div className="mt-12">
        <Row name="Display" spec="editorial · hero · <h1>">
          <Display as="p">Where Craft Becomes Art</Display>
        </Row>

        <Row name="Display" spec="editorial · muted continuation">
          <Display as="p">
            <HeadingLine>The Menu</HeadingLine>
            <HeadingMuted>Treatments &amp; Curation</HeadingMuted>
          </Display>
        </Row>

        <Row name="H1" spec="editorial · roman + italic line">
          <H1 as="p">
            <HeadingLine>A Selection</HeadingLine>
            <HeadingAccent>of the Studio&rsquo;s Best</HeadingAccent>
          </H1>
        </Row>

        <Row name="H2" spec="editorial · section">
          <H2 as="p">
            <HeadingLine>Nails as a medium.</HeadingLine>
            <HeadingAccent>Silence as a luxury.</HeadingAccent>
          </H2>
        </Row>

        <Row name="H3" spec="editorial · titles">
          <H3 as="p">Classic Gel Extension</H3>
        </Row>

        <Row name="Eyebrow" spec="functional · uppercase · wide">
          <Eyebrow>Most Requested</Eyebrow>
        </Row>

        <Row name="Lead" spec="functional · intro">
          <Lead>
            The Curation Studio is a private atelier in the heart of Copenhagen.
          </Lead>
        </Row>

        <Row name="Body" spec="functional · running text">
          <Body>
            We operate by appointment only — no walk-ins, no noise, no
            compromise. Each session is a study in precision and restraint.
          </Body>
        </Row>

        <Row name="Body / small" spec="functional · muted">
          <BodySm>
            By appointment only. The studio is never shared between clients.
          </BodySm>
        </Row>

        <Row name="Quote" spec="editorial · italic">
          <Quote>
            &ldquo;The most considered nail experience I have ever had. The
            silence alone is worth the price.&rdquo;
          </Quote>
        </Row>

        <Row name="Caption" spec="functional · attribution">
          <Caption>Ashley H. · Architect, Copenhagen</Caption>
        </Row>
      </div>
    </main>
  );
}
