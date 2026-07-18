import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google"

/**
 * Brand fonts, declared once and shared by every root layout (the client site
 * under `[locale]` and the admin under `/admin` are separate root layouts, so
 * both need the same font variables on their `<html>`). Declaring them here —
 * rather than in each layout — keeps the config identical and lets next/font
 * dedupe the actual downloads.
 */

// font-editorial — Cormorant Garamond. Italic is part of the brand: headings
// pair a roman line with an italic/muted second line.
export const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
})

// font-functional — Plus Jakarta Sans.
export const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
})

/** Both font CSS-variable classes, for a root `<html className>`. */
export const fontVariables = `${cormorant.variable} ${jakarta.variable}`
