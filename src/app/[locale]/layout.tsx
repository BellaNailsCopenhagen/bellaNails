import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import { daDK, enUS } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { routing } from "@/i18n/routing";
import "../globals.css";

// font-editorial — Figma "Collection 1". Italic is part of the brand:
// section headings pair a roman line with an italic second line.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

// font-functional — Figma "Collection 1"
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

// Pre-render both locales at build time (static, no per-request work).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ),
    title: {
      default: t("title"),
      template: "%s · Bella Nails",
    },
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Reject unknown locales (the proxy only routes da/en, but a direct hit on
  // e.g. /fr would otherwise render with the default locale).
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Opt this layout into static rendering for the resolved locale.
  setRequestLocale(locale);

  return (
    // Locale-aware Clerk routes so sign-in/up stay under the active locale.
    // ClerkProvider lives inside <body> (Clerk requirement), wrapping the
    // intl provider so Clerk's components can read translations if needed.
    <html
      lang={locale}
      className={`${cormorant.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          signInUrl={`/${locale}/sign-in`}
          signUpUrl={`/${locale}/sign-up`}
          appearance={{ theme: shadcn }}
          localization={locale === "da" ? daDK : enUS}
        >
          <NextIntlClientProvider>
            <SiteHeader />
            {children}
            <SiteFooter year={new Date().getFullYear()} />
          </NextIntlClientProvider>
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  );
}
