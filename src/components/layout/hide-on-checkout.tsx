"use client"

import { usePathname } from "@/i18n/navigation"
import { isCheckoutPath } from "@/config/routes"

/**
 * Drops its children on the checkout routes (/book, /confirmation), where every
 * extra link is a way out of a flow the visitor already started. What's left in
 * the header — the wordmark and the locale toggle — stays exactly where it sits
 * everywhere else, so the chrome thins out rather than rearranging.
 *
 * Children render on the server and arrive as an RSC payload; this only decides
 * whether to mount them, which is why it can wrap server components.
 */
export function HideOnCheckout({ children }: { children: React.ReactNode }) {
  // next-intl's usePathname() is already locale-stripped ("/book", not "/en/book").
  return isCheckoutPath(usePathname()) ? null : <>{children}</>
}
