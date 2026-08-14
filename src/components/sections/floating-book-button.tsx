"use client"

import { useEffect, useState } from "react"

import { Link } from "@/i18n/navigation"
import { routes } from "@/config/routes"

/**
 * A book CTA that slides in once the visitor has scrolled into a service's
 * detail page, so the action is always a tap away without crowding the top.
 */
export function FloatingBookButton({
  serviceId,
  label,
}: {
  serviceId: string
  label: string
}) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 320)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 transition-all duration-300 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <Link
        href={{ pathname: routes.book, query: { service: serviceId } }}
        tabIndex={shown ? undefined : -1}
        aria-hidden={!shown}
        className={`inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 font-functional text-xs uppercase tracking-widest-lux text-background shadow-xl transition-colors hover:bg-foreground/90 ${
          shown ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {label}
      </Link>
    </div>
  )
}
