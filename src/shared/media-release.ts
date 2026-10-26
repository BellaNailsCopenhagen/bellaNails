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

/** A purpose's state as the UI reads it. `none` is not a stored status — it is
    the absence of a row, i.e. a purpose the studio never asked about. */
export const RELEASE_STATES = [
  "none",
  "requested",
  "granted",
  "declined",
  "withdrawn",
] as const
export type ReleaseState = (typeof RELEASE_STATES)[number]

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
  /**
   * Why a save didn't happen, keyed by the code the action returns.
   *
   * The actions here deliberately answer with stable codes rather than prose —
   * a code is a contract, prose is a language — but nothing was translating
   * them, so `useActionRunner` toasted "not_found" at the client.
   */
  errors: {
    invalid_link: string
    not_found: string
    save_failed: string
    update_failed: string
    already_decided: string
    unauthorized: string
    unknown: string
  }
  /** My Space release cards (registered client). */
  ui: {
    sectionTitle: string
    sectionIntro: string
    /** The tab opens by explaining the process — the same substance the emailed
        approval page gives, so a choice made here is just as informed. */
    explainTitle: string
    explainSteps: string[]
    explainNote: string
    allow: string
    decline: string
    shared: string
    stopSharing: string
    /** Waiting on the client — the studio has asked and nothing is decided. */
    awaiting: string
    /** No media on this appointment yet, so there is nothing to show anywhere. */
    noMediaYet: string
    /** No past appointments at all — the tab has nothing to list. */
    noAppointments: string
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
    errors: {
      invalid_link: "Linket er ikke gyldigt længere — bed studiet om et nyt.",
      not_found: "Vi kan ikke finde den tid.",
      save_failed: "Kunne ikke gemme dit valg — prøv igen.",
      update_failed: "Kunne ikke gemme ændringen — prøv igen.",
      already_decided: "Det er allerede besvaret. Du kan ændre det i Mit rum.",
      unauthorized: "Log ind for at ændre dette.",
      unknown: "Det gik ikke igennem — prøv igen om et øjeblik.",
    },
    ui: {
      sectionTitle: "Brug af billeder og video",
      sectionIntro:
        "Alle dine tider står her — også dem vi ikke har spurgt om. Du bestemmer for hver enkelt, og kan altid trække det tilbage.",
      explainTitle: "Sådan fungerer det",
      explainSteps: [
        "Vi spørger for hver tid og for hvert sted — vores hjemmeside, sociale medier eller undervisning. Intet hænger sammen: ja til ét er ikke ja til de andre.",
        "Det gælder billederne og videoen af dine negle fra den tid — selve arbejdet. Dit navn og dine ord spørger vi særskilt om længere nede på siden.",
        "Intet bliver vist, før du siger ja. En tid, vi ikke har spurgt om, er din at tilbyde — eller at lade stå præcis som den er.",
        "Du kan altid ombestemme dig. Vores hjemmeside opdateres med det samme; et opslag på sociale medier tager vi ned i hånden, som regel inden for få dage.",
      ],
      explainNote:
        "Dit valg er frit, og intet omkring dine tider afhænger af det.",
      allow: "Tillad",
      decline: "Nej tak",
      shared: "Delt",
      stopSharing: "Stop deling",
      awaiting: "Venter på dit svar",
      noMediaYet: "Ingen billeder fra denne tid endnu.",
      noAppointments:
        "Når du har været her, står tiden på listen — sammen med dine valg om den.",
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
        description:
          "In the gallery on our website, so new clients can see our work.",
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
    errors: {
      invalid_link:
        "That link isn't valid any more — ask the studio for a new one.",
      not_found: "We can't find that appointment.",
      save_failed: "Couldn't save your choice — please try again.",
      update_failed: "Couldn't save that change — please try again.",
      already_decided:
        "That has already been answered. You can change it in My Space.",
      unauthorized: "Please sign in to change this.",
      unknown: "That didn't go through — please try again in a moment.",
    },
    ui: {
      sectionTitle: "Use of photos & video",
      sectionIntro:
        "Every appointment you've had is listed here, including the ones we haven't asked about. You decide for each, and you can withdraw anytime.",
      explainTitle: "How this works",
      explainSteps: [
        "We ask per appointment, and per place — our website, social media, or teaching. Nothing is bundled: yes to one is not yes to the others.",
        "It covers the photos and video of your nails from that appointment — the work itself. Your name and your words are asked for separately, further down this page.",
        "Nothing is shown anywhere until you say yes. An appointment we haven't asked about is yours to offer, or to leave exactly as it is.",
        "You can change your mind at any time. Our website updates straight away; a social post we take down by hand, usually within a few days.",
      ],
      explainNote:
        "Your choice is free, and nothing about your appointments depends on it.",
      allow: "Allow",
      decline: "No thanks",
      shared: "Shared",
      stopSharing: "Stop sharing",
      awaiting: "Waiting for your answer",
      noMediaYet: "No photos from this appointment yet.",
      noAppointments:
        "Once you've had an appointment, it will be listed here along with your choices about it.",
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

/** DOM id of an appointment's permission card. Defined with the card, not at
    either end, so the photo that links to it and the card it lands on can never
    drift apart. */
export const releaseCardId = (bookingId: string) => `release-${bookingId}`

export type ReleasePurposeState = {
  purpose: ReleasePurpose
  status: ReleaseState
}

/**
 * Every purpose, always, in one fixed order — the shape My Space renders.
 *
 * Two things were wrong with rendering the stored rows directly: a purpose the
 * studio had not asked about simply vanished, and the rows arrive in whatever
 * order Postgres returns them, so answering one item reshuffled the others under
 * the client's finger. Projecting onto the constant fixes both, and makes the
 * card's shape independent of what happens to be stored.
 */
export function fillReleasePurposes(
  states: ReleasePurposeState[],
): ReleasePurposeState[] {
  const byPurpose = new Map(states.map((s) => [s.purpose, s.status]))

  return RELEASE_PURPOSES.map((purpose) => ({
    purpose,
    status: byPurpose.get(purpose) ?? "none",
  }))
}

/** Of a permission that is NOT currently given: does allowing it now mean
    allowing it *again*? Only a withdrawal follows a real grant — a first ask and
    a refusal are both plainly "allow". */
export const isRegrant = (status: ReleaseState) => status === "withdrawn"

/** Group release rows by their booking — the one shape My Space + the admin card
    both read. Structural input so it stays free of any db type. */
export function groupReleasesByBooking(
  rows: { booking_id: string; purpose: string; status: string }[],
): Map<string, ReleasePurposeState[]> {
  const map = new Map<string, ReleasePurposeState[]>()
  for (const r of rows) {
    const list = map.get(r.booking_id) ?? []
    list.push({
      purpose: r.purpose as ReleasePurpose,
      status: r.status as ReleaseState,
    })
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

/** One of the actions' codes, in the visitor's language. Anything unrecognised
    falls to `unknown` rather than being shown raw. */
export function releaseErrorCopy(
  locale: string,
  code: string | undefined,
): string {
  const { errors } = pickReleaseCopy(locale)

  return code && code in errors
    ? errors[code as keyof typeof errors]
    : errors.unknown
}
