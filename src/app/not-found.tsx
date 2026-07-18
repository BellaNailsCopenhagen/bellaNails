import Link from "next/link"

import { routing } from "@/i18n/routing"

/**
 * Root not-found fallback — the last resort for URLs that never reach a locale
 * segment (e.g. an unknown `/fr/…` locale rejected by the layout, or a
 * dotted path like `/foo.bar` the proxy skips). The proxy prefixes every real
 * HTML route with a locale, so this is rarely hit; almost all 404s render the
 * branded, localized `[locale]/not-found.tsx` instead.
 *
 * There is no `app/layout.tsx` (the root layout lives at `[locale]/layout.tsx`),
 * so this file must provide its own `<html>`/`<body>` and cannot use the
 * locale-loaded brand fonts or i18n. It is intentionally self-contained and
 * bilingual, and sends the visitor into the default locale.
 */
export default function RootNotFound() {
  const home = `/${routing.defaultLocale}`

  return (
    <html lang={routing.defaultLocale}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f7f5f2", // Alabaster
          color: "#121212", // Onyx
          fontFamily: "Georgia, 'Times New Roman', serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              opacity: 0.6,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            404
          </p>
          <h1 style={{ margin: "1rem 0 0", fontSize: "2rem", fontWeight: 500 }}>
            Siden findes ikke
            <br />
            <span style={{ opacity: 0.5 }}>Page not found</span>
          </h1>
          <p style={{ margin: "1.5rem 0 2rem", lineHeight: 1.6, opacity: 0.8 }}>
            Denne side kunne ikke findes. · This page could not be found.
          </p>
          <Link
            href={home}
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              backgroundColor: "#121212",
              color: "#f7f5f2",
              textDecoration: "none",
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Bella Nails — Forsiden / Home
          </Link>
        </main>
      </body>
    </html>
  )
}
