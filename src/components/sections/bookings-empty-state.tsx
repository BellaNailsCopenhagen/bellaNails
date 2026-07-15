import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { routes } from "@/config/routes"

/** "No appointments yet" + the book CTA; extra actions via children. */
function BookingsEmptyState({ children }: { children?: React.ReactNode }) {
  const t = useTranslations("bookings")
  return (
    <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
      <Button nativeButton={false} render={<Link href={routes.book} />}>
        {t("emptyCtaBook")}
      </Button>
      {children}
    </EmptyState>
  )
}

export { BookingsEmptyState }
