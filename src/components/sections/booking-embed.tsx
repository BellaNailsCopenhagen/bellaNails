"use client";

import * as React from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { Caption } from "@/components/ui/typography";
import type { BookingContact } from "@/lib/contact-validation";
import { CALCOM_EMBED_JS_URL, CALCOM_ORIGIN } from "@/config/calcom";
import { routes } from "@/config/routes";

/** Skeleton and iframe share this height — unequal values reintroduce the
    layout shift the fixed shell exists to prevent. */
const EMBED_MIN_HEIGHT = "36rem";

/** IDs-only machine payload for the webhook (Task 02) — never parsed as text. */
type BookingMetadata = {
  serviceId: string;
  addonIds: string[];
  totalPriceCents: number;
  totalDurationMins: number;
  locale: string;
};

/**
 * BookingEmbed — the inline Cal.com booker (EU instance), pre-configured with
 * the computed slot length, contact prefill from step 02, the localized notes
 * summary, and IDs-only metadata. Client component: the embed needs the
 * browser. On a successful booking it redirects to /confirmation with the
 * Cal booking uid.
 */
export function BookingEmbed({
  calLink,
  slotMins,
  prefill,
  notesSummary,
  metadata,
}: {
  calLink: string;
  slotMins: number;
  prefill: BookingContact;
  notesSummary: string;
  metadata: BookingMetadata;
}) {
  const t = useTranslations("booking");
  const router = useRouter();
  // Skeleton shows until Cal reports the booker ready — leaving it mounted
  // behind the loaded iframe reads as a duplicated container.
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const onLinkReady = () => setReady(true);
    const onBooked = (event: { detail: { data: { uid?: string } } }) => {
      const { uid } = event.detail.data;
      router.push({
        pathname: routes.confirmation,
        query: uid ? { uid } : undefined,
      });
    };

    let calApi: Awaited<ReturnType<typeof getCalApi>> | undefined;
    (async () => {
      const cal = await getCalApi({ embedJsUrl: CALCOM_EMBED_JS_URL });
      if (cancelled) return;
      calApi = cal;
      cal("ui", {
        theme: "light",
        hideEventTypeDetails: false,
        cssVarsPerTheme: {
          // The embed is forced to light theme, but the type requires both.
          light: { "cal-brand": "#121212" },
          dark: { "cal-brand": "#fbfbfa" },
        },
      });
      cal("on", { action: "linkReady", callback: onLinkReady });
      cal("on", { action: "bookingSuccessfulV2", callback: onBooked });
    })();

    return () => {
      cancelled = true;
      // getCalApi hands back a window-level singleton: without `off`, every
      // remount (locale switch, back/forward) stacks another handler and one
      // booking would push to /confirmation once per stacked listener.
      calApi?.("off", { action: "linkReady", callback: onLinkReady });
      calApi?.("off", { action: "bookingSuccessfulV2", callback: onBooked });
    };
  }, [router]);

  // The visitor's own notes ride along under the composed summary so the
  // artist sees both; metadata keys use Cal's `metadata[key]` param form.
  const notes = [notesSummary, prefill.notes].filter(Boolean).join("\n\n");

  return (
    <div className="w-full">
      <div className="relative" style={{ minHeight: EMBED_MIN_HEIGHT }}>
        {/* Branded skeleton while the booker boots (fixed-height shell = no
            layout shift); removed on linkReady so it can't peek out around
            the loaded iframe. */}
        {ready ? null : (
          <div
            aria-hidden
            className="absolute inset-0 -z-10 flex items-center justify-center rounded-lg border border-border bg-muted/60"
          >
            <Caption className="tracking-widest-lux">
              {t("embedLoading")}
            </Caption>
          </div>
        )}
        <Cal
          calLink={calLink}
          calOrigin={CALCOM_ORIGIN}
          embedJsUrl={CALCOM_EMBED_JS_URL}
          config={{
            name: prefill.name ?? "",
            email: prefill.email ?? "",
            ...(prefill.phone ? { attendeePhoneNumber: prefill.phone } : {}),
            notes,
            duration: String(slotMins),
            // NOTE: Cal cloud has no per-visitor language override — the
            // booker auto-detects the browser language (calcom/cal.com#8904).
            // Revisit if Cal ships a ?language= param.
            theme: "light",
            "metadata[serviceId]": metadata.serviceId,
            "metadata[addonIds]": metadata.addonIds.join(","),
            "metadata[totalPriceCents]": String(metadata.totalPriceCents),
            "metadata[totalDurationMins]": String(metadata.totalDurationMins),
            "metadata[locale]": metadata.locale,
          }}
          style={{ width: "100%", minHeight: EMBED_MIN_HEIGHT }}
        />
      </div>
    </div>
  );
}

export type { BookingMetadata };
