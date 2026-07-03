import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Bella Nails typography scale — derived from the Bella Nails designs.
 *
 * Two faces carry everything:
 *  - `font-editorial`  (Cormorant Garamond) — display, headings, quotes.
 *  - `font-functional` (Plus Jakarta Sans)  — eyebrows, body, captions.
 *
 * Brand signature: headings often pair a lead line with an italic or muted
 * continuation — compose `HeadingLine` with `HeadingAccent` / `HeadingMuted`
 * inside an editorial heading (see below).
 */
const typographyVariants = cva("", {
  variants: {
    variant: {
      // Hero statement — "Where Craft Becomes Art"
      display:
        "font-editorial font-normal tracking-tightest text-balance text-5xl leading-[1.04] sm:text-6xl lg:text-7xl",
      // Large heading, one step below display (alt page title)
      h1: "font-editorial font-normal tracking-tightest text-balance text-4xl leading-[1.1] sm:text-5xl",
      // Section heading — "A Selection of the Studio's Best"
      h2: "font-editorial font-normal tracking-tightest text-balance text-[1.75rem] leading-[1.15] sm:text-4xl",
      // Service & feature titles — "Classic Gel Extension", "The Atelier Edit"
      h3: "font-editorial font-normal text-xl leading-snug sm:text-2xl",
      // Tiny uppercase overline — "MOST REQUESTED", "THE PHILOSOPHY"
      eyebrow:
        "font-functional text-[11px] leading-[1.1] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
      // Larger intro paragraph
      lead: "font-functional text-base leading-relaxed text-muted-foreground sm:text-lg",
      // Default running text
      body: "font-functional text-base leading-relaxed text-foreground",
      // Small supporting copy — most descriptive text on this design
      bodySm: "font-functional text-sm leading-relaxed text-muted-foreground",
      // Testimonials — serif italic
      quote:
        "font-editorial italic text-pretty text-xl leading-relaxed sm:text-2xl",
      // Attributions & meta — "ASHLEY H.", "90 MINS"
      caption:
        "font-functional text-xs uppercase tracking-wider text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

type TypographyVariant = NonNullable<
  VariantProps<typeof typographyVariants>["variant"]
>;

/**
 * Default elements match each heading's name, so there are no surprises:
 * `<H2>` renders `<h2>`, etc. `Display` is the large page-title style and
 * renders `<h1>` — use it for the page's single top heading, on the home hero
 * *and* on every inner page (services, booking, details…). Section headings
 * then use `H2`/`H3`. Reach for the `H1` component only when you want `<h1>`
 * semantics without the hero size; don't pair it with `Display` on one page.
 * Override any default with `as`.
 */
const defaultElement: Record<TypographyVariant, React.ElementType> = {
  display: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  eyebrow: "p",
  lead: "p",
  body: "p",
  bodySm: "p",
  quote: "blockquote",
  caption: "span",
};

type TypographyProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof typographyVariants> & {
    /** Override the rendered element (e.g. `as="h2"` on a display variant). */
    as?: React.ElementType;
  };

function Typography({ as, variant, className, ...props }: TypographyProps) {
  // cva allows `variant` to be null/undefined; normalize once for both the
  // element lookup and the generated classes.
  const resolved = variant ?? "body";
  const Comp = as ?? defaultElement[resolved];
  return (
    <Comp
      data-slot="typography"
      className={cn(typographyVariants({ variant: resolved }), className)}
      {...props}
    />
  );
}

/**
 * Building blocks for the brand's multi-line headings. Each renders a
 * block-level span so every line sits on its own row; compose them inside an
 * editorial heading. Two accent styles appear across the designs:
 *   - `HeadingAccent` — italic continuation ("A Selection / of the Studio's Best")
 *   - `HeadingMuted`  — muted-color continuation ("The Menu / Treatments & Curation")
 * Italic and muting come from CSS (the loaded Cormorant italic face / the
 * `muted-foreground` token), so there's no <em> and no <br> hacks.
 *
 *   <Display>
 *     <HeadingLine>The Menu</HeadingLine>
 *     <HeadingMuted>Treatments &amp; Curation</HeadingMuted>
 *   </Display>
 */
function HeadingLine({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("block", className)} {...props} />;
}

function HeadingAccent({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("block italic", className)} {...props} />;
}

function HeadingMuted({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("block text-muted-foreground", className)}
      {...props}
    />
  );
}

type NamedProps = Omit<TypographyProps, "variant">;

const Display = (props: NamedProps) => (
  <Typography variant="display" {...props} />
);
const H1 = (props: NamedProps) => <Typography variant="h1" {...props} />;
const H2 = (props: NamedProps) => <Typography variant="h2" {...props} />;
const H3 = (props: NamedProps) => <Typography variant="h3" {...props} />;
const Eyebrow = (props: NamedProps) => (
  <Typography variant="eyebrow" {...props} />
);
const Lead = (props: NamedProps) => <Typography variant="lead" {...props} />;
const Body = (props: NamedProps) => <Typography variant="body" {...props} />;
const BodySm = (props: NamedProps) => <Typography variant="bodySm" {...props} />;
const Quote = (props: NamedProps) => <Typography variant="quote" {...props} />;
const Caption = (props: NamedProps) => (
  <Typography variant="caption" {...props} />
);

export {
  Typography,
  typographyVariants,
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
};
export type { TypographyProps, TypographyVariant };
