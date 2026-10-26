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
    // Reveal after a little scroll — but always show on a short page that can't
    // scroll (e.g. a service with no sections/photos), so Book is never absent.
    const update = () => {
      const notScrollable =
        document.documentElement.scrollHeight <= window.innerHeight + 40
      setShown(notScrollable || window.scrollY > 320)
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)

    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
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
