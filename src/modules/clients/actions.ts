"use server"

import { getTranslations } from "next-intl/server"

import { resolveLocale } from "@/i18n/routing"

import { revalidatePath } from "next/cache"
import { hasLocale } from "next-intl"

import { routing } from "@/i18n/routing"
import { getCurrentUser } from "@/modules/identity/server"
import { requireOwner } from "@/modules/identity/require-owner"
import { updateClientCommunicationLocale, updateClientProfile } from "@/db/clients"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { revalidatePatterns } from "@/shared/routes"

export type ProfileResult = { ok: true } | { ok: false; error: string }

const MAX_NAME = 100
const MAX_PHONE = 40

/** A signed-in client edits their own name + phone (My space). */
export async function updateMyProfile(input: {
  name: string
  phone: string
  /** The locale they are looking at, so a refusal comes back in it. */
  locale: string
}): Promise<ProfileResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "not signed in" }

  const t = await getTranslations({
    locale: resolveLocale(input.locale),
    namespace: "account",
  })

  const name = input.name.trim()
  const phone = input.phone.trim()
  if (name.length > MAX_NAME) return { ok: false, error: t("errNameTooLong") }
  if (phone.length > MAX_PHONE) return { ok: false, error: t("errPhoneTooLong") }

  const saved = await updateClientProfile(createSupabaseServiceRoleClient(), user.id, {
    name: name || null,
    phone: phone || null,
  })
  if (!saved.ok) return { ok: false, error: saved.message ?? "failed" }
  return { ok: true }
}

/** The owner sets which language a client's transactional emails use (da/en). */
export async function setClientCommunicationLocale(
  clientId: string,
  locale: string,
): Promise<ProfileResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }
  if (!hasLocale(routing.locales, locale)) {
    return { ok: false, error: "Invalid locale." }
  }

  const saved = await updateClientCommunicationLocale(db, clientId, locale)
  if (!saved.ok) return { ok: false, error: "Couldn't save." }

  revalidatePath(revalidatePatterns.adminClient, "page")
  return { ok: true }
}
