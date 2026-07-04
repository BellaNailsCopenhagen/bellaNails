import * as React from "react";

import { cn } from "@/lib/utils";

import { Eyebrow, H1, HeadingAccent, HeadingLine } from "./typography";

type SectionHeadingProps = {
  eyebrow: React.ReactNode;
  lead: React.ReactNode;
  accent?: React.ReactNode;
  className?: string;
  accentClassName?: string;
};

/**
 * Reusable editorial section intro: small eyebrow plus a two-line heading.
 * Most marketing sections share this exact composition.
 */
function SectionHeading({
  eyebrow,
  lead,
  accent,
  className,
  accentClassName,
}: SectionHeadingProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <H1 as="h2">
        <HeadingLine>{lead}</HeadingLine>
        {accent ? (
          <HeadingAccent className={accentClassName}>{accent}</HeadingAccent>
        ) : null}
      </H1>
    </div>
  );
}

export { SectionHeading };
export type { SectionHeadingProps };
