"use client"

import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BodySm, Caption } from "@/components/ui/typography"
import { fieldLabel } from "@/components/admin/field-label"
import { matchesClientSearch } from "@/shared/client-search"
import { EMAIL_PATTERN } from "@/shared/contact-validation"

import type { ClientOption, ClientRef } from "./types"

const MAX_ROWS = 8

/**
 * Step 1 — pick who the booking is for: search the existing roster (name/email),
 * or toggle to a new client and capture name + email (+ optional phone). Selection
 * yields a ClientRef the flow hands straight to createBookingAsOwner.
 */
export function ClientStep({ clients, onSelect }: {
  clients: ClientOption[]
  onSelect: (ref: ClientRef) => void
}) {
  const [newMode, setNewMode] = useState(false)
  const [query, setQuery] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  const matches = useMemo(() => {
    if (!query.trim()) return clients.slice(0, MAX_ROWS)
    return clients
      .filter((c) => matchesClientSearch(c.search, query))
      .slice(0, MAX_ROWS)
  }, [query, clients])

  const canAddNew = name.trim().length >= 2 && EMAIL_PATTERN.test(email.trim())

  if (newMode) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-name" className={fieldLabel}>Name</Label>
            <Input
              id="new-name"
              value={name}
              onValueChange={setName}
              placeholder="Full name"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-email" className={fieldLabel}>Email</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onValueChange={setEmail}
              placeholder="name@example.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-phone" className={fieldLabel}>Phone (optional)</Label>
            <Input
              id="new-phone"
              type="tel"
              value={phone}
              onValueChange={setPhone}
              placeholder="+45 12 34 56 78"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            disabled={!canAddNew}
            onClick={() =>
              onSelect({
                kind: "new",
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
              })
            }
          >
            Use this client
          </Button>
          <button
            type="button"
            onClick={() => setNewMode(false)}
            className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
          >
            Search existing
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Input
        type="search"
        placeholder="Search name, phone, or email"
        value={query}
        onValueChange={setQuery}
        aria-label="Search clients"
      />

      <div className="space-y-2">
        <Caption className="block text-[10px] tracking-widest-lux">
          Existing clients
        </Caption>
        {matches.length ? (
          <ul className="border-t border-border">
            {matches.map((client) => (
              <li key={client.id} className="border-b border-border">
                <button
                  type="button"
                  onClick={() =>
                    onSelect({ kind: "existing", id: client.id, name: client.name })
                  }
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="truncate font-functional text-sm text-foreground">
                    {client.name}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <BodySm className="py-2">No client matches that search.</BodySm>
        )}
      </div>

      <button
        type="button"
        onClick={() => setNewMode(true)}
        className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      >
        + New client
      </button>
    </div>
  )
}
