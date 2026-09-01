/**
 * Booking-level media releases — the client-safe vocabulary + consent copy.
 * One source of truth for the purposes, their grouping, and the natural da / en
 * wording shown on the public approval page and in My Space. No vendor / service
 * / UI imports — usable from a client component, a server action, and a page.
 *
 * Danish law (GDPR Art. 6(1)(a) + 7): consent to use a person's photos/videos in
 * marketing must be specific per purpose, informed (named channels), documented
 * (the stored `consent_version`), and withdrawable at any time.
 */

/** Bump when the consent wording/scope below changes materially — stored on each
    grant so we can prove exactly what a client agreed to. */
export const MEDIA_RELEASE_CONSENT_VERSION = "2026-08-v1"

export const RELEASE_PURPOSES = ["website", "social", "education"] as const
export type ReleasePurpose = (typeof RELEASE_PURPOSES)[number]

export function isReleasePurpose(value: string): value is ReleasePurpose {
  return (RELEASE_PURPOSES as readonly string[]).includes(value)
}

type PurposeCopy = { label: string; description: string }

type ReleaseCopy = {
  heading: string
  /** Short two-line page title (the editorial header — lead + muted line). */
  requestTitle: { lead: string; muted: string }
  /** The identifying line — which appointment's media this covers (helper text). */
  appointment: (service: string, when: string, ref: string) => string
  /** Reassurance shown under the identifying line. */
  helper: string
  /** Warm opener for the confirmation opt-in. */
  honoured: string
  /** Short prompt above the purpose checkboxes. */
  choose: string
  intro: string
  purposes: Record<ReleasePurpose, PurposeCopy>
  withdrawal: string
  approve: string
  declineAll: string
  /** Shown once a decision is recorded. */
  granted: string
  declined: string
  /** My Space release cards (registered client). */
  ui: {
    sectionTitle: string
    sectionIntro: string
    allow: string
    decline: string
    shared: string
    stopSharing: string
    /** Terminal state + the way back — re-granting must be as easy as leaving. */
    notShared: string
    allowAgain: string
    retract: {
      title: string
      body: string
      confirm: string
      confirming: string
      cancel: string
    }
  }
}

export const MEDIA_RELEASE_COPY: Record<"da" | "en", ReleaseCopy> = {
  da: {
    heading: "Tilladelse til at bruge billeder og video fra din tid",
    requestTitle: { lead: "Dine negle,", muted: "dit valg" },
    appointment: (service, when, ref) =>
      `Fra din ${service}-tid den ${when} (booking #${ref}).`,
    helper:
      "Vi viser kun dine negle og selve arbejdet — aldrig noget, du ikke har sagt ja til. Dit valg er frit, og du kan altid ændre det.",
    honoured: "Vi vil være beærede over at vise dine negle frem.",
    choose: "Hvad må vi bruge det til?",
    intro:
      "Det gælder billederne og videoen af dine negle fra denne tid — hele klippet eller korte klip med fokus på arbejdet.",
    purposes: {
      website: {
        label: "Vores hjemmeside",
        description:
          "I galleriet på vores hjemmeside, så nye kunder kan se vores arbejde.",
      },
      social: {
        label: "Sociale medier",
        description: "På vores Instagram, Facebook, TikTok og YouTube.",
      },
      education: {
        label: "Undervisning",
        description: "I vejledninger og undervisning — til at dele teknikken.",
      },
    },
    withdrawal:
      "Dit valg er helt frit. Du kan godkende nogle, alle eller ingen, og du kan til enhver tid trække din tilladelse tilbage (i Mit rum eller ved at svare på denne e-mail) — så holder vi op med at bruge det.",
    approve: "Gem mine valg",
    declineAll: "Afvis alle",
    granted: "Tak — dine valg er gemt.",
    declined: "Noteret — vi bruger ikke dine optagelser.",
    ui: {
      sectionTitle: "Brug af billeder og video",
      sectionIntro:
        "Salonen har bedt om lov til at bruge medier fra disse tider. Du bestemmer, og kan altid trække det tilbage.",
      allow: "Tillad",
      decline: "Nej tak",
      shared: "Delt",
      stopSharing: "Stop deling",
      notShared: "Deles ikke",
      allowAgain: "Tillad igen",
      retract: {
        title: "Trække tilladelse tilbage?",
        body: "Vi holder op med at bruge medier fra denne tid til dette formål. Alt der allerede er offentligt, fjernes.",
        confirm: "Træk tilbage",
        confirming: "Trækker tilbage…",
        cancel: "Behold",
      },
    },
  },
  en: {
    heading: "Permission to use photos & video from your appointment",
    requestTitle: { lead: "Your nails,", muted: "your choice" },
    appointment: (service, when, ref) =>
      `From your ${service} appointment on ${when} (booking #${ref}).`,
    helper:
      "We only ever show your nails and the work — never anything you didn't agree to. Your choice is free, and you can change it anytime.",
    honoured: "We'd be honoured to feature your nails.",
    choose: "What may we use it for?",
    intro:
      "This covers the photos and video of your nails from this appointment — the full clip or short highlights of the work.",
    purposes: {
      website: {
        label: "Our website",
        description: "In the gallery on our website, so new clients can see our work.",
      },
      social: {
        label: "Social media",
        description: "On our Instagram, Facebook, TikTok and YouTube.",
      },
      education: {
        label: "Education",
        description: "In tutorials and training, to teach and share technique.",
      },
    },
    withdrawal:
      "Your choice is entirely free. You can approve some, all, or none, and you can withdraw your permission at any time (in My Space or by replying to this email) — we'll then stop using it.",
    approve: "Save my choices",
    declineAll: "Decline all",
    granted: "Thank you — your choices are saved.",
    declined: "Noted — we won't use your recordings.",
    ui: {
      sectionTitle: "Use of photos & video",
      sectionIntro:
        "The studio asked to use media from these appointments. It's your choice, and you can withdraw anytime.",
      allow: "Allow",
      decline: "No thanks",
      shared: "Shared",
      stopSharing: "Stop sharing",
      notShared: "Not shared",
      allowAgain: "Allow again",
      retract: {
        title: "Withdraw permission?",
        body: "We'll stop using media from this appointment for this purpose. Anything already public is removed.",
        confirm: "Withdraw",
        confirming: "Withdrawing…",
        cancel: "Keep",
      },
    },
  },
}

export const pickReleaseCopy = (locale: string) =>
  locale === "en" ? MEDIA_RELEASE_COPY.en : MEDIA_RELEASE_COPY.da

/** A short, human booking reference from its id — used in the consent copy. */
export const bookingRef = (bookingId: string) =>
  bookingId.slice(0, 8).toUpperCase()

export type ReleasePurposeState = { purpose: ReleasePurpose; status: string }

/** Group release rows by their booking — the one shape My Space + the admin card
    both read. Structural input so it stays free of any db type. */
export function groupReleasesByBooking(
  rows: { booking_id: string; purpose: string; status: string }[],
): Map<string, ReleasePurposeState[]> {
  const map = new Map<string, ReleasePurposeState[]>()
  for (const r of rows) {
    const list = map.get(r.booking_id) ?? []
    list.push({ purpose: r.purpose as ReleasePurpose, status: r.status })
    map.set(r.booking_id, list)
  }
  return map
}

/** One booking's release request as My Space (and the public page) render it —
    the appointment label plus each purpose's state. Names stay locale-split so
    the client component localizes. */
export type ReleaseRequestCard = {
  bookingId: string
  serviceNameEn: string | null
  serviceNameDk: string | null
  startIso: string | null
  ref: string
  purposes: ReleasePurposeState[]
}

/** Build a release card from a booking's label fields + its purpose states —
    the one place the card shape is assembled (My Space + the public page share it). */
export function toReleaseCard(
  bookingId: string,
  names: { serviceNameEn?: string | null; serviceNameDk?: string | null },
  startIso: string | null,
  purposes: ReleasePurposeState[],
): ReleaseRequestCard {
  return {
    bookingId,
    serviceNameEn: names.serviceNameEn ?? null,
    serviceNameDk: names.serviceNameDk ?? null,
    startIso,
    ref: bookingRef(bookingId),
    purposes,
  }
}
