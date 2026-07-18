import type { Metadata, Viewport } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { enUS } from "@clerk/localizations"

import { Toaster } from "@/components/ui/sonner"
import { AdminShell } from "@/components/admin/admin-shell"
import { BRAND } from "@/config/brand"
import { fontVariables } from "@/config/fonts"
import { clerkAppearance } from "@/config/clerk"
import "../globals.css"

// The admin is an internal owner tool — keep it out of every index. The
// manifest + apple-touch icon are declared HERE (not at the app root) so they
// scope to /admin only; the client site must not advertise the studio app.
export const metadata: Metadata = {
  title: {
    default: "Bella Nails Studio",
    template: "%s · Bella Nails Studio",
  },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  // iOS standalone home-screen app. The apple-touch icon comes from
  // app/admin/apple-icon.tsx; the manifest covers Android/desktop install.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bella Nails",
  },
}

export const viewport: Viewport = {
  themeColor: BRAND.background,
  // Cover the notch/safe areas for a native standalone feel. Pinch-zoom is
  // left enabled on purpose (accessibility).
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

/**
 * Admin root layout. English-only and NOT locale-prefixed (owner decision),
 * so there is no next-intl provider and no SiteHeader/SiteFooter — the admin
 * renders its own AdminShell. The proxy gates /admin to the owner before any
 * of this runs.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full" suppressHydrationWarning>
        <ClerkProvider
          signInUrl="/en/sign-in"
          signUpUrl="/en/sign-up"
          localization={enUS}
          appearance={clerkAppearance}
        >
          <AdminShell>{children}</AdminShell>
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  )
}
