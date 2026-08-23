import { revalidatePath } from "next/cache"

import { routing } from "@/i18n/routing"
import { routes } from "@/shared/routes"

/**
 * The public pages that render placed client assets: the home page (showcase
 * surface) and /gallery (clients_gallery surface). Revalidate them — per locale,
 * since localePrefix is always — whenever a placement changes, so newly placed
 * work appears and withdrawn/removed work disappears without waiting on a deploy.
 */
export function revalidatePublicSurfaces() {
  for (const locale of routing.locales) {
    revalidatePath(routes.public.localeHome(locale))
    revalidatePath(routes.public.gallery(locale))
  }
}
