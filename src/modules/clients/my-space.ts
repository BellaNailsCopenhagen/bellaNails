import "server-only"

import { getClientProfile, type ClientProfile } from "@/db/clients"
import { createAuthedSupabaseServerClient } from "@/platform/supabase/server"
import {
  getClientDataConsents,
  getClientMedia,
  pendingRequestCount,
  type ClientMediaItem,
  type DataConsentItem,
} from "@/modules/media"
import { getTermsAcceptances, type TermsAcceptance } from "@/modules/terms"

/**
 * Everything the signed-in client's own page renders, in one call. Each part
 * degrades independently — the media and consent tables may not be migrated in
 * a given environment, and a missing one must not take the page down.
 */
export type MySpace = {
  media: ClientMediaItem[]
  dataConsents: DataConsentItem[]
  requestCount: number
  terms: TermsAcceptance[]
  profile: ClientProfile | null
}

export const EMPTY_MY_SPACE: MySpace = {
  media: [],
  dataConsents: [],
  requestCount: 0,
  terms: [],
  profile: null,
}

export async function getMySpace(clientId: string): Promise<MySpace> {
  const db = await createAuthedSupabaseServerClient()
  const [media, dataConsents, requestCount, terms, profile] = await Promise.all([
    getClientMedia(db, clientId).catch(() => []),
    getClientDataConsents(db, clientId).catch(() => []),
    pendingRequestCount(db, clientId).catch(() => 0),
    getTermsAcceptances(db, clientId).catch(() => []),
    getClientProfile(db, clientId).catch(() => null),
  ])
  return { media, dataConsents, requestCount, terms, profile }
}

/** The consent + terms panels on a client's admin detail page. */
export async function getClientPrivacyRecord(clientId: string): Promise<{
  dataConsents: DataConsentItem[]
  terms: TermsAcceptance[]
}> {
  const db = await createAuthedSupabaseServerClient()
  const [dataConsents, terms] = await Promise.all([
    getClientDataConsents(db, clientId).catch(() => []),
    getTermsAcceptances(db, clientId).catch(() => []),
  ])
  return { dataConsents, terms }
}
