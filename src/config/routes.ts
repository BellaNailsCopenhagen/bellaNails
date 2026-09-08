import type enMessages from "../../messages/en.json"
import type { BusinessProfile } from "@/shared/business-profile"

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
  requestSent: "/request-sent",
  ask: "/ask",
  hours: "/hours",
  terms: "/terms",
  privacy: "/privacy",
  signIn: "/login",
} as const

export type Route = (typeof routes)[keyof typeof routes]

/**
 * The pages a search engine should know about: every permanent public
 * destination, and nothing else. Drives `sitemap.ts` and is where a page earns
 * a canonical + hreflang pair.
 *
 * Listed explicitly rather than derived from the route table, because a
 * sitemap's failure mode is *including* something — a checkout step, one
 * client's token link, a signed-in page — so each entry should be a decision.
 * Typed as `Route`, so renaming a route breaks the build here rather than
 * quietly dropping a page out of the index.
 *
 * Deliberately left out:
 * - `/book`, `/confirmation`, `/request-sent` — steps inside a flow, and a
 *   confirmation belongs to one booking.
 * - `/appointments` and its reschedule route — signed in only.
 * - `/login` — nothing to rank.
 * - `/ask` — a personal enquiry form, and already `robots: index: false`.
 *   Listing a noindex page is a contradiction a crawler will report back.
 * - `/approve`, `/manage`, `/offer`, `/testimonial` — one person's signed link.
 * - `/services/[id]` — the detail pages have no sections, gallery or reviews
 *   yet, so indexing them would submit five thin near-duplicates of the menu.
 *   They belong here the day they have content.
 * - `/styleguide` — internal.
 */
export const indexableRoutes: Route[] = [
  routes.home,
  routes.services,
  routes.gallery,
  routes.hours,
  routes.terms,
  routes.privacy,
]

/** Paths no crawler should follow: the studio's own tool, and the signed links
    that belong to one client. Prefix matches — `/offer` covers `/offer/<token>`. */
export const disallowedPaths: string[] = [
  "/admin",
  "/api",
  "/da/approve",
  "/en/approve",
  "/da/manage",
  "/en/manage",
  "/da/offer",
  "/en/offer",
  "/da/testimonial",
  "/en/testimonial",
]

/** The booking funnel. Its chrome is stripped to the wordmark + locale so the
    visitor isn't offered a way out mid-flow. */
const checkoutRoutes: string[] = [
  routes.book,
  routes.confirmation,
  routes.requestSent,
]

/** `pathname` must be locale-stripped (next-intl's `usePathname()`). */
export function isCheckoutPath(pathname: string): boolean {
  return checkoutRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}

/** One client's offer, reached by its signed token (segment must match
    app/[locale]/offer/[token]). */
export function offerPath(token: string): string {
  return `/offer/${token}`
}

/** One client's testimonial invitation, by its signed token (segment must match
    app/[locale]/testimonial/[token]). */
export function testimonialPath(token: string): string {
  return `/testimonial/${token}`
}

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

/**
 * Footer navigation, grouped into columns.
 *
 * A function of the studio's own profile, not a constant: the social links and
 * the support address are hers to set, and a column of dead links to
 * instagram.com was worse than no column. A social account she hasn't given us
 * is simply left out — including its whole column, if she has none.
 */
export function footerNavFor(profile: BusinessProfile): FooterColumn[] {
  const social: FooterNavLink[] = []
  if (profile.instagramUrl) {
    social.push({ href: profile.instagramUrl, labelKey: "instagram", external: true })
  }
  if (profile.facebookUrl) {
    social.push({ href: profile.facebookUrl, labelKey: "facebook", external: true })
  }
  if (profile.tiktokUrl) {
    social.push({ href: profile.tiktokUrl, labelKey: "tiktok", external: true })
  }

  return [
    {
      headingKey: "studio",
      links: [
        { href: routes.services, labelKey: "services" },
        { href: routes.gallery, labelKey: "gallery" },
        { href: routes.hours, labelKey: "hours" },
        { href: routes.ask, labelKey: "ask" },
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
    ...(social.length ? [{ headingKey: "follow" as const, links: social }] : []),
    // No address configured → no Help column. `mailto:` with nothing after it
    // opens a blank compose window, which is worse than no link.
    ...(profile.contactEmail
      ? [
          {
            headingKey: "help" as const,
            links: [
              {
                href: `mailto:${profile.contactEmail}`,
                labelKey: "contactSupport" as const,
                external: true as const,
              },
              {
                href: `mailto:${profile.contactEmail}?subject=Bug%20report`,
                labelKey: "reportBug" as const,
                external: true as const,
              },
            ],
          },
        ]
      : []),
  ]
}
