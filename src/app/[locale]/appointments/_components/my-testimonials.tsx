import { getTranslations } from "next-intl/server"

import { Badge } from "@/components/ui/badge"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { TestimonialQuote } from "@/components/testimonials/testimonial-quote"
import { TestimonialControls } from "@/app/[locale]/appointments/_components/testimonial-controls"
import type { MyTestimonial } from "@/modules/testimonials"

/** Take it down, put it back, or erase the words — all per testimonial, because
    that is the unit permission was given in. */
export async function MyTestimonials({ items }: { items: MyTestimonial[] }) {
  const t = await getTranslations("testimonialForm")
  if (!items.length) {
    return null
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Eyebrow>{t("myTitle")}</Eyebrow>
        <BodySm className="max-w-prose text-xs text-muted-foreground">
          {t("myIntro")}
        </BodySm>
      </div>

      <ul className="space-y-8">
        {items.map((item) => (
          <li
            key={item.id}
            className="space-y-4 border-b border-border pb-8 last:border-b-0"
          >
            <Badge
              variant={item.state === "showing" ? "success" : "outline"}
              size="xs"
            >
              {t(`state.${item.state}`)}
            </Badge>

            {item.body && item.authorName ? (
              <TestimonialQuote
                item={{
                  id: item.id,
                  authorName: item.authorName,
                  occupation: item.occupation,
                  body: item.body,
                }}
              />
            ) : null}

            <TestimonialControls
              id={item.id}
              state={item.state}
              labels={{
                withdraw: t("myWithdraw"),
                withdrawing: t("myWithdrawing"),
                withdrawTitle: t("myWithdrawTitle"),
                withdrawBody: t("myWithdrawBody"),
                withdrawConfirm: t("myWithdrawConfirm"),
                withdrawCancel: t("myWithdrawCancel"),
                restore: t("myRestore"),
                restoring: t("myRestoring"),
                erase: t("myErase"),
                erasing: t("myErasing"),
                eraseTitle: t("myEraseTitle"),
                eraseBody: t("myEraseBody"),
                eraseConfirm: t("myEraseConfirm"),
                eraseCancel: t("myEraseCancel"),
                failed: t("myFailed"),
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
