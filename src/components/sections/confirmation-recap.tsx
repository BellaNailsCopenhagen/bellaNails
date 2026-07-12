"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import type { BookingRecap } from "@/app/api/bookings/[uid]/route";
import { AppointmentSummary } from "@/components/sections/appointment-summary";
import { BodySm, Caption, Eyebrow } from "@/components/ui/typography";
import { BOOKING_STATUS } from "@/lib/booking-status";
import { cn } from "@/lib/utils";

/** The confirm step already waits for the webhook row before navigating
    here, so the first fetch normally succeeds instantly. The long tail is a
    safety net for the wait's ~15 s timeout path and direct/old-link visits —
    attempts run sequentially, never overlapping. */
const RETRY_DELAYS_MS = [0, 1500, 4000, 8000, 15000];

const STUDIO_TIME_ZONE = "Europe/Copenhagen";

/** The tinted card shell shared by every recap state — matches the
    AppointmentSummary aside it renders next to. */
function RecapCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-lg border border-border bg-muted/60 p-6 sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * ConfirmationRecap — fetches the booking row and renders date/time + the
 * shared AppointmentSummary. The embed's "securing" hold means the row is
 * normally already there; degrades to a calm "details are in your email"
 * note if it never lands, and to an explicit notice for a booking that has
 * since been cancelled (revisited old link) — never a broken card.
 */
export function ConfirmationRecap({ uid }: { uid: string }) {
  const t = useTranslations("confirmation");
  const locale = useLocale();
  const [recap, setRecap] = React.useState<BookingRecap | null>(null);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      for (const delay of RETRY_DELAYS_MS) {
        if (delay) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        if (cancelled) return;
        try {
          const res = await fetch(
            `/api/bookings/${encodeURIComponent(uid)}?locale=${locale}`,
          );
          if (cancelled) return;
          if (res.ok) {
            setRecap((await res.json()) as BookingRecap);
            return;
          }
        } catch {
          // Network hiccup or aborted body — indistinguishable from webhook
          // lag; fall through to the next attempt.
        }
      }
      if (!cancelled) setMissing(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, locale]);

  if (missing) {
    return (
      <RecapCard className="max-w-[22.5rem]">
        <BodySm>{t("recapFallback")}</BodySm>
      </RecapCard>
    );
  }

  if (!recap) {
    return (
      <RecapCard
        aria-busy
        className="flex max-w-[22.5rem] items-center justify-center py-16"
      >
        <Caption className="tracking-widest-lux">{t("recapLoading")}</Caption>
      </RecapCard>
    );
  }

  // A revisited link for a booking that was cancelled (or replaced by a
  // reschedule — Cal issues the new time a fresh uid) must not present the
  // old slot as reserved.
  if (recap.status === BOOKING_STATUS.cancelled) {
    return (
      <RecapCard className="max-w-[22.5rem]">
        <BodySm>{t("recapCancelled")}</BodySm>
      </RecapCard>
    );
  }

  const start = new Date(recap.startTime);
  const dateLine = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: STUDIO_TIME_ZONE,
  }).format(start);
  const timeLine = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: STUDIO_TIME_ZONE,
  }).format(start);

  return (
    <div className="w-full max-w-[22.5rem] space-y-6">
      <RecapCard>
        <div className="space-y-2">
          <Eyebrow className="font-normal">{t("whenLabel")}</Eyebrow>
          <BodySm className="font-editorial text-xl text-foreground">
            {dateLine}
          </BodySm>
          <Caption className="block tracking-wide normal-case">
            {t("timeAt")} {timeLine}
          </Caption>
        </div>
      </RecapCard>

      {recap.selection ? (
        <AppointmentSummary
          service={recap.selection.service}
          selectedAddons={recap.selection.addons}
          showTimeNote={false}
        />
      ) : (
        <RecapCard>
          <BodySm>{t("recapFallback")}</BodySm>
        </RecapCard>
      )}
    </div>
  );
}
