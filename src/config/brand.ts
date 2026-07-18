/**
 * Brand palette for JS-only rendering contexts that can't read CSS custom
 * properties: the OG image (Satori has no CSS pipeline) and Cal's embed
 * theming API. MUST mirror the `--bn-*` values in `src/app/globals.css` —
 * that file stays the source of truth for everything browser-rendered.
 */
export const BRAND = {
  background: "#fbfbfa",
  card: "#f5f3ef",
  textPrimary: "#1a1a19",
  textSecondary: "#66635f",
  divider: "#e4e0d9",
  cta: "#121212",
} as const
