"use client"

import { useState } from "react"
import { Settings } from "lucide-react"

import { cn } from "@/lib/utils"
import { ProfileForm } from "@/components/account/profile-form"
import type { TermsAcceptance } from "@/lib/terms-acceptance"

const TERMS_LABEL: Record<string, string> = {
  service: "Booking terms",
  data: "Privacy & data use",
}

/**
 * My space content: accepted-terms tab on the left, a settings icon pushed to
 * the far right for your account details (name + phone). Details is the default.
 */
export function AccountTabs({
  name,
  phone,
  terms,
  locale,
}: {
  name: string | null
  phone: string | null
  terms: TermsAcceptance[]
  locale: string
}) {
  const [tab, setTab] = useState<"account" | "terms">("account")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-border pb-3">
        {terms.length ? (
          <button
            type="button"
            onClick={() => setTab("terms")}
            className={cn(
              "font-functional text-xs uppercase tracking-widest-lux transition-colors",
              tab === "terms"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Accepted terms
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setTab("account")}
          aria-label="Your details"
          title="Your details"
          className={cn(
            "ml-auto flex size-8 items-center justify-center rounded-full border transition-colors",
            tab === "account"
              ? "border-foreground text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <Settings className="size-4" />
        </button>
      </div>

      {tab === "account" ? (
        <ProfileForm name={name} phone={phone} />
      ) : (
        <ul className="space-y-2">
          {terms.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 font-functional text-sm"
            >
              <span className="text-foreground">
                {TERMS_LABEL[t.kind] ?? t.kind}
              </span>
              <span className="text-xs text-muted-foreground">
                v{t.version} · {new Date(t.acceptedAt).toLocaleDateString(locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
