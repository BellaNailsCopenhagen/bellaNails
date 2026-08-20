import { NotFound } from "@/app/[locale]/_components/not-found"

/**
 * Localized 404. Renders inside `[locale]/layout.tsx` (header/footer/providers
 * + active locale), so it stays fully branded. Triggered either by an explicit
 * `notFound()` in a page/segment or by the `[locale]/[...rest]` catch-all that
 * forces unknown localized slugs into this segment. Next serves it with a 404
 * status and auto-injects `noindex`.
 */
export default function LocaleNotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <NotFound />
    </main>
  )
}
