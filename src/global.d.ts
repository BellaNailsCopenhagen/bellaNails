import type { routing } from "@/i18n/routing"
import type messages from "../messages/en.json"

// Type-safe locales and message keys across next-intl APIs. `useTranslations`
// / `getTranslations` now autocomplete keys and flag typos at build time.
// `en` is the reference catalog; `da` must mirror its shape.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number]
    Messages: typeof messages
  }
}

declare global {
  /**
   * Claims we add to the Clerk **session token** (Dashboard → Sessions →
   * Customize session token):
   *   { "metadata": { "role": "{{user.public_metadata.role}}" } }
   * so `auth().sessionClaims.metadata.role` is typed. Read only via
   * `isOwner()` (`src/lib/admin/owner.ts`); the same claim path backs the
   * Supabase owner-reads-all RLS.
   */
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: string
    }
  }
}
