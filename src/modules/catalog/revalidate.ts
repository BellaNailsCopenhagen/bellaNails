import { revalidatePath } from "next/cache"

import { routing } from "@/i18n/routing"
import { routes, revalidatePatterns } from "@/shared/routes"

/**
 * The pages a catalog write changes. `/[locale]/services` and the home page
 * (its featured strip) are both prerendered from the anon client, so neither
 * picks up a price, name, category or menu-order change without this.
 */
export function revalidateCatalogSurfaces() {
  revalidatePath(routes.admin.services)
  revalidatePath(revalidatePatterns.publicServices, "page")
  for (const locale of routing.locales) revalidatePath(routes.public.localeHome(locale))
}
