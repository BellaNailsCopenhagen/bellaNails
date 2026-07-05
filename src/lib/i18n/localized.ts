/**
 * Picks the value for the active locale from a paired `_en`/`_dk` column set.
 *
 * Danish (`da`) maps to the `_dk` column per the schema convention; any other
 * locale uses `_en`. A missing localized value falls back to English so partial
 * translations never render blank. Returns `null` only when both are absent —
 * callers decide the final fallback (e.g. a placeholder or empty string).
 */
export function pickLocalized(
  locale: string,
  en: string | null,
  dk: string | null,
): string | null {
  return (locale === "da" ? dk : en) ?? en;
}
