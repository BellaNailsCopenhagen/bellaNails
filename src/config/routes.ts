import type enMessages from "../../messages/en.json"

import { STUDIO_EMAIL } from "./studio"

/**
 * Central route registry — the single source of truth for every internal path
 * and outbound social link. Import these instead of hardcoding `href` strings
 * so paths can be renamed in one place and never drift between components.
 *
 * Header and footer navigation are exposed as *separate* subsets (`headerNav`,
 * `footerNav`): they draw from the same route constants but are intentionally
 * allowed to diverge in what they surface and how they group it.
 */
export const routes = {
  home: "/",
  services: "/services",
  gallery: "/gallery",
  appointments: "/appointments",
  book: "/book",
  confirmation: "/confirmation",
  terms: "/terms",
  privacy: "/privacy",
  signIn: "/login",
} as const

export type Route = (typeof routes)[keyof typeof routes]

/** Outbound social links (open in a new tab). */
export const externalLinks = {
  instagram: "https://instagram.com",
  facebook: "https://facebook.com",
} as const

// Label keys are validated against the real i18n catalogs so a renamed message
// key fails the build here rather than rendering a raw key at runtime.
type NavLabelKey = keyof (typeof enMessages)["nav"]
type FooterLabelKey = keyof (typeof enMessages)["footer"]

/** A primary nav entry. `labelKey` resolves against the `nav` i18n namespace. */
export type NavItem = { href: Route; labelKey: NavLabelKey }

/** In-app reschedule for one appointment (dynamic — hence a builder, not a
    constant; the segment must match app/[locale]/appointments/reschedule/[id]). */
export function rescheduleBookingPath(id: string): string {
  return `${routes.appointments}/reschedule/${encodeURIComponent(id)}`
}

/** Public "learn more" detail page for one service (app/[locale]/services/[id]). */
export function serviceDetailPath(id: string): string {
  return `${routes.services}/${id}`
}

/** Primary header navigation. */
export const headerNav: NavItem[] = [
  { href: routes.services, labelKey: "services" },
  { href: routes.gallery, labelKey: "gallery" },
  { href: routes.appointments, labelKey: "space" },
]

/**
 * A footer link. Internal links resolve their label against the `nav`
 * namespace; external (social) links against `footer`.
 */
export type FooterNavLink =
  | { href: Route; labelKey: NavLabelKey; external?: false }
  | { href: string; labelKey: FooterLabelKey; external: true }

/** A footer column: a heading (from the `footer` namespace) plus its links. */
export type FooterColumn = {
  headingKey: FooterLabelKey
  links: FooterNavLink[]
}

/** Footer navigation, grouped into columns. */
export const footerNav: FooterColumn[] = [
  {
    headingKey: "studio",
    links: [
      { href: routes.services, labelKey: "services" },
      { href: routes.gallery, labelKey: "gallery" },
    ],
  },
  {
    headingKey: "session",
    links: [{ href: routes.book, labelKey: "reserve" }],
  },
  {
    headingKey: "legal",
    links: [
      { href: routes.terms, labelKey: "terms" },
      { href: routes.privacy, labelKey: "privacy" },
    ],
  },
  {
    headingKey: "follow",
    links: [
      { href: externalLinks.instagram, labelKey: "instagram", external: true },
      { href: externalLinks.facebook, labelKey: "facebook", external: true },
    ],
  },
  {
    headingKey: "help",
    links: [
      {
        href: `mailto:${STUDIO_EMAIL}`,
        labelKey: "contactSupport",
        external: true,
      },
      {
        href: `mailto:${STUDIO_EMAIL}?subject=Bug%20report`,
        labelKey: "reportBug",
        external: true,
      },
    ],
  },
]
