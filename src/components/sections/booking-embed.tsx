"use client";

import * as React from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { Caption } from "@/components/ui/typography";
import { CALCOM_EMBED_JS_URL, CALCOM_ORIGIN } from "@/config/calcom";
import { routes } from "@/config/routes";

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
  prefill: { name?: string; email?: string; phone?: string; notes?: string };
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
    (async () => {
      const cal = await getCalApi({ embedJsUrl: CALCOM_EMBED_JS_URL });
      if (cancelled) return;
      cal("ui", {
        theme: "light",
        hideEventTypeDetails: false,
        cssVarsPerTheme: {
          // The embed is forced to light theme, but the type requires both.
          light: { "cal-brand": "#121212" },
          dark: { "cal-brand": "#fbfbfa" },
        },
      });
      cal("on", {
        action: "linkReady",
        callback: () => setReady(true),
      });
      cal("on", {
        action: "bookingSuccessfulV2",
        callback: (event) => {
          const { uid } = event.detail.data;
          router.push({
            pathname: routes.confirmation,
            query: uid ? { uid } : undefined,
          });
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // The visitor's own notes ride along under the composed summary so the
  // artist sees both; metadata keys use Cal's `metadata[key]` param form.
  const notes = [notesSummary, prefill.notes].filter(Boolean).join("\n\n");

  return (
    <div className="w-full">
      <div className="relative min-h-[36rem]">
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
          style={{ width: "100%", minHeight: "36rem" }}
        />
      </div>
    </div>
  );
}

export type { BookingMetadata };
