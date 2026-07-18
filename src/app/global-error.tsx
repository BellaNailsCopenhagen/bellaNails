"use client"

import { useEffect } from "react"

/**
 * Global error boundary — the last resort for errors thrown in the root
 * (`[locale]`) layout itself, which `[locale]/error.tsx` cannot catch (an
 * error boundary never wraps the layout in its own segment). It replaces the
 * entire document, so it must render its own `<html>`/`<body>` and cannot use
 * the brand fonts, tokens, or i18n. Kept self-contained and bilingual, mirroring
 * `app/not-found.tsx`.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="da">
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
            Bella Nails
          </p>
          <h1 style={{ margin: "1rem 0 0", fontSize: "2rem", fontWeight: 500 }}>
            Noget gik galt
            <br />
            <span style={{ opacity: 0.5 }}>Something went wrong</span>
          </h1>
          <p style={{ margin: "1.5rem 0 2rem", lineHeight: 1.6, opacity: 0.8 }}>
            Der opstod en uventet fejl. · An unexpected error occurred.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              border: "none",
              cursor: "pointer",
              backgroundColor: "#121212",
              color: "#f7f5f2",
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Prøv igen / Try again
          </button>
        </main>
      </body>
    </html>
  )
}
