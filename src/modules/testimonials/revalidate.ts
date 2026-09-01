import { revalidatePath } from "next/cache"

import { revalidateLocaleHomes } from "@/modules/revalidate"
import { routes, revalidatePatterns } from "@/shared/routes"

/**
 * The pages a testimonial write changes: the studio's curation queue, the
 * client's My Space, and the prerendered home sections — all three read the
 * same rows, so any one write can go stale in the other two.
 */
export function revalidateTestimonialSurfaces(): void {
  revalidatePath(routes.admin.testimonials)
  revalidatePath(revalidatePatterns.publicAppointments, "page")
  revalidateLocaleHomes()
}
