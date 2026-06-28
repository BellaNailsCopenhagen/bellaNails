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
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";

export const metadata: Metadata = {
  title: "Styleguide",
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

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <H3 as="h2" className="mt-20 first:mt-12">
      {children}
    </H3>
  );
}

export default function StyleguidePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-28">
      <Eyebrow>Design System</Eyebrow>
      <H1 className="mt-4">
        <HeadingLine>Design</HeadingLine>
        <HeadingAccent>system</HeadingAccent>
      </H1>
      <Lead className="mt-5 max-w-xl">
        The Bella Nails primitives — Cormorant Garamond for editorial voice, Plus
        Jakarta Sans for everything functional.
      </Lead>

      <GroupTitle>Typography</GroupTitle>

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
          We operate by appointment only — no walk-ins, no noise, no compromise.
          Each session is a study in precision and restraint.
        </Body>
      </Row>

      <Row name="Body / small" spec="functional · muted">
        <BodySm>
          By appointment only. The studio is never shared between clients.
        </BodySm>
      </Row>

      <Row name="Quote" spec="editorial · italic">
        <Quote>
          &ldquo;The most considered nail experience I have ever had. The silence
          alone is worth the price.&rdquo;
        </Quote>
      </Row>

      <Row name="Caption" spec="functional · attribution">
        <Caption>Ashley H. · Architect, Copenhagen</Caption>
      </Row>

      <GroupTitle>Buttons</GroupTitle>

      <Row name="Button" spec="variants">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Reserve session</Button>
          <Button variant="outline">View menu</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="link">Back to selection</Button>
        </div>
      </Row>

      <Row name="Button" spec="inverse · on dark">
        <div className="flex flex-wrap items-center gap-3 rounded-sm bg-foreground p-6">
          <Button variant="inverse">Reserve your session</Button>
        </div>
      </Row>

      <Row name="Button" spec="sizes">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </Row>

      <Row name="Button" spec="disabled">
        <Button disabled>Reserve session</Button>
      </Row>

      <GroupTitle>Prices</GroupTitle>

      <Row name="PriceTag" spec="base · add-on · total">
        <div className="flex flex-wrap items-baseline gap-8">
          <PriceTag cents={65000} className="text-xl" />
          <PriceTag cents={5000} sign className="text-xl" />
          <PriceTag cents={82000} className="text-3xl" />
        </div>
      </Row>
    </main>
  );
}
