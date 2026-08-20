"use client"

import { useState } from "react"

import { Eyebrow } from "@/components/ui/typography"
import { ServiceRow } from "@/app/admin/services/_components/service-row"
import type { AdminService } from "@/modules/catalog"

/** Archived services, tucked behind a Show/Hide toggle at the foot of the list
    so they stay out of the way but remain reachable (to restore/inspect). */
export function ArchivedServices({ services }: { services: AdminService[] }) {
  const [open, setOpen] = useState(false)
  if (services.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eyebrow as="h3">Archived</Eyebrow>
          <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
            ({services.length})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open ? (
        <ul>
          {services.map((service) => (
            <ServiceRow key={service.id} service={service} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
