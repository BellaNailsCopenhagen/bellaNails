import { revalidatePath } from "next/cache"

import { revalidateLocaleHomes } from "@/modules/revalidate"
import { routes, revalidatePatterns } from "@/shared/routes"

/**
 * The pages a catalog write changes. `/[locale]/services` and the home page
 * (its featured strip) are both prerendered from the anon client, so neither
 * picks up a price, name, category or menu-order change without this.
 */
export function revalidateCatalogSurfaces() {
  revalidatePath(routes.admin.services)
  revalidatePath(revalidatePatterns.publicServices, "page")
  revalidateLocaleHomes()
}
