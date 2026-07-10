import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";
import { BookingSteps } from "@/components/sections/booking-steps";
import { ArrowLink } from "@/components/ui/arrow-link";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";

/**
 * BookingStepHeader — the chrome every booking step shares: back link,
 * step indicator, hairline, then the editorial PageHeader. One component so
 * the three steps (and any future ones) can't drift apart.
 */
export async function BookingStepHeader({
  current,
  backHref,
  backLabel,
  eyebrow,
  lead,
  muted,
  intro,
}: {
  current: ComponentProps<typeof BookingSteps>["current"];
  backHref: ComponentProps<typeof Link>["href"];
  backLabel: React.ReactNode;
  eyebrow: React.ReactNode;
  lead: React.ReactNode;
  muted?: React.ReactNode;
  intro?: React.ReactNode;
}) {
  return (
    <>
      <div className="space-y-4 pb-8">
        <ArrowLink back href={backHref} className="text-[10px]">
          {backLabel}
        </ArrowLink>
        <BookingSteps current={current} />
      </div>

      <Separator />

      <PageHeader
        className="py-16"
        eyebrow={eyebrow}
        lead={lead}
        muted={muted}
        intro={intro}
      />
    </>
  );
}
