import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { testimonialPath } from "@/config/routes"

/**
 * The in-app half of a testimonial invitation — the email carries the same
 * signed link, so a client who missed it still finds the ask where their other
 * pending items live.
 */
export async function TestimonialInviteCard({ token }: { token: string }) {
  const t = await getTranslations("bookings")

  return (
    <section className="space-y-3 border-l-2 border-foreground pl-4">
      <Eyebrow>{t("testimonialInviteTitle")}</Eyebrow>
      <BodySm className="max-w-prose text-xs text-muted-foreground">
        {t("testimonialInviteBody")}
      </BodySm>
      <Button
        size="sm"
        nativeButton={false}
        render={<Link href={testimonialPath(token)} />}
      >
        {t("testimonialInviteCta")}
      </Button>
    </section>
  )
}
