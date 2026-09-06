import type { Locale } from "@/i18n/routing"

/**
 * The one place route strings live. Two namespaces that must never be conflated:
 *
 * - `routes` builds concrete URLs — for `href`, `redirect`, `router.push`, and
 *   the per-URL form of `revalidatePath` (e.g. one client's page).
 * - `revalidatePatterns` holds the bracket ROUTE PATTERNS that
 *   `revalidatePath(pattern, "page")` matches to invalidate a dynamic route.
 *   A typo there fails silently (stale UI, no error) — hence the named SSOT.
 *
 * Public navigation goes through next-intl's typed helpers (`@/i18n/navigation`)
 * which prefix the locale; only the locale-prefixed paths `revalidatePath` needs
 * live here.
 */

const adminNewQuery = (q?: {
  client?: string
  service?: string
  addons?: string[]
}): string => {
  if (!q) return ""
  const p = new URLSearchParams()
  if (q.client) p.set("client", q.client)
  if (q.service) p.set("service", q.service)
  if (q.addons?.length) p.set("addons", q.addons.join(","))
  const s = p.toString()
  return s ? `?${s}` : ""
}

export const routes = {
  admin: {
    home: "/admin",
    /** The home queue, scrolled to one thread / booking request. A `?focus=`
        param, not a `#hash`: /admin is dynamic, so the anchor doesn't exist yet
        when the browser looks for it. */
    homeFocus: (elementId: string) =>
      `/admin?focus=${encodeURIComponent(elementId)}`,
    agenda: "/admin/agenda",
    appointments: "/admin/appointments",
    hours: "/admin/hours",
    settings: "/admin/settings",
    business: "/admin/business",
    more: "/admin/more",
    terms: "/admin/terms",
    testimonials: "/admin/testimonials",
    testimonialFocus: (id: string) =>
      `/admin/testimonials?focus=${encodeURIComponent(`testimonial-${id}`)}`,
    notifications: "/admin/notifications",
    assets: "/admin/assets",
    gallery: "/admin/gallery",
    assetHighlight: (id: string) => `/admin/assets?highlight=${id}`,
    clients: "/admin/clients",
    client: (id: string) => `/admin/clients/${id}`,
    services: "/admin/services",
    service: (id: string) => `/admin/services/${id}`,
    reschedule: (id: string) => `/admin/reschedule/${id}`,
    newBooking: (q?: { client?: string; service?: string; addons?: string[] }) =>
      `/admin/new${adminNewQuery(q)}`,
  },
  // Locale-prefixed public paths — only what revalidatePath needs (in-app
  // navigation uses next-intl's typed Link/redirect instead).
  public: {
    localeHome: (locale: Locale) => `/${locale}`,
    gallery: (locale: Locale) => `/${locale}/gallery`,
  },
} as const

/**
 * Bracket ROUTE PATTERNS for `revalidatePath(pattern, "page")` — the dynamic
 * route's cache key, not a navigable URL. Kept apart from `routes` on purpose.
 */
export const revalidatePatterns = {
  adminClient: "/admin/clients/[id]",
  /** The public shell. Revalidated as a LAYOUT, which takes every page under it
      — the footer lives here, so a contact/social change touches all of them. */
  publicLayout: "/[locale]",
  publicAppointments: "/[locale]/appointments",
  publicManage: "/[locale]/manage/[token]",
  publicServices: "/[locale]/services",
} as const
