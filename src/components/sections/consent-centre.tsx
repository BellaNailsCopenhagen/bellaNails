"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { TintedCard } from "@/components/ui/tinted-card"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { ConfirmActionButton } from "@/components/sections/confirm-action-button"
import type {
  ClientMediaItem,
  DataConsentItem,
  MediaPurpose,
} from "@/lib/media"
import {
  decideDataConsent,
  decideMediaConsent,
  withdrawDataConsent,
  withdrawMediaConsent,
} from "@/lib/actions/client-consent"

// Small red "only touch if you mean to" pill for the destructive withdraw.
const withdrawPill =
  "self-start rounded-full border border-destructive/40 px-2.5 py-1 font-functional text-[0.625rem] uppercase tracking-widest-lux text-destructive/80 transition-colors hover:border-destructive hover:text-destructive"

const PURPOSE_TEXT: Record<MediaPurpose, string> = {
  site: "our website",
  some: "social media",
}

const DATA_TEXT: Record<string, string> = {
  name_site: "your first name on our website",
  name_some: "your first name on social media",
  testimonial_site: "your words as a testimonial on our website",
  testimonial_some: "your words as a testimonial on social media",
}

type MediaRequest = { media: ClientMediaItem; purpose: MediaPurpose }

/**
 * The client's consent centre on /bookings — every request the studio has made
 * to publish a photo or use their data, with Approve / Decline / Withdraw. The
 * client is always in control; nothing is published without an explicit grant.
 */
export function ConsentCentre({
  media,
  dataConsents,
}: {
  media: ClientMediaItem[]
  dataConsents: DataConsentItem[]
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const t = useTranslations("bookings")

  // Flatten media into per-purpose requests the client can act on.
  const requests: MediaRequest[] = []
  for (const item of media) {
    for (const purpose of ["site", "some"] as MediaPurpose[]) {
      const status = item[purpose]
      if (status === "requested" || status === "granted") {
        requests.push({ media: item, purpose })
      }
    }
  }
  const dataRequests = dataConsents.filter(
    (c) => c.status === "requested" || c.status === "granted",
  )

  if (!requests.length && !dataRequests.length) return null

  const act = (fn: () => Promise<{ ok: boolean; note?: string; error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        toast.error("Something went wrong. Try again.")
        return
      }
      if (result.note) toast.success(result.note)
      router.refresh()
    })

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Eyebrow>Your permissions</Eyebrow>
        <BodySm className="text-xs">
          Bella Nails asks before sharing anything of yours. You can change your
          mind any time.
        </BodySm>
      </div>

      <div className="space-y-3">
        {requests.map(({ media: item, purpose }) => (
          <TintedCard
            key={`${item.id}-${purpose}`}
            className="flex items-center gap-4 p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt="Your appointment photo"
              className="size-16 shrink-0 rounded-sm border border-border object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="font-functional text-sm text-foreground">
                Share this photo on {PURPOSE_TEXT[purpose]}?
              </p>
              {item[purpose] === "granted" ? (
                <p className="font-functional text-xs text-success">
                  Shared — thank you
                </p>
              ) : null}
            </div>
            {item[purpose] === "granted" ? (
              <ConfirmActionButton
                action={() => withdrawMediaConsent(item.id, purpose)}
                labels={{
                  title:
                    purpose === "site"
                      ? t("withdrawSiteTitle")
                      : t("withdrawSomeTitle"),
                  body:
                    purpose === "site"
                      ? t("withdrawSiteBody")
                      : t("withdrawSomeBody"),
                  confirm: t("withdrawConfirm"),
                  confirming: t("withdrawConfirming"),
                  cancel: t("deleteCancel"),
                  failed: t("loadError"),
                }}
                trigger={
                  <button type="button" className={withdrawPill}>
                    {purpose === "site"
                      ? t("removeFromWebsite")
                      : t("removeFromSocial")}
                  </button>
                }
              />
            ) : (
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    act(() => decideMediaConsent(item.id, purpose, "declined"))
                  }
                >
                  No
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    act(() => decideMediaConsent(item.id, purpose, "granted"))
                  }
                >
                  Allow
                </Button>
              </div>
            )}
          </TintedCard>
        ))}

        {dataRequests.map((consent) => (
          <TintedCard
            key={consent.purpose}
            className="flex items-center gap-4 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-functional text-sm text-foreground">
                Use {DATA_TEXT[consent.purpose] ?? consent.purpose}?
              </p>
              {consent.status === "granted" ? (
                <p className="font-functional text-xs text-success">Allowed</p>
              ) : null}
            </div>
            {consent.status === "granted" ? (
              <ConfirmActionButton
                action={() =>
                  withdrawDataConsent(
                    consent.purpose as Parameters<typeof withdrawDataConsent>[0],
                  )
                }
                labels={{
                  title: t("withdrawDataTitle"),
                  body: t("withdrawDataBody"),
                  confirm: t("withdrawConfirm"),
                  confirming: t("withdrawConfirming"),
                  cancel: t("deleteCancel"),
                  failed: t("loadError"),
                }}
                trigger={
                  <button type="button" className={withdrawPill}>
                    {t("stopUsingCta")}
                  </button>
                }
              />
            ) : (
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    act(() =>
                      decideDataConsent(
                        consent.purpose as Parameters<typeof decideDataConsent>[0],
                        "declined",
                      ),
                    )
                  }
                >
                  No
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    act(() =>
                      decideDataConsent(
                        consent.purpose as Parameters<typeof decideDataConsent>[0],
                        "granted",
                      ),
                    )
                  }
                >
                  Allow
                </Button>
              </div>
            )}
          </TintedCard>
        ))}
      </div>
    </section>
  )
}
