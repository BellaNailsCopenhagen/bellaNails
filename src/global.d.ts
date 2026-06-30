import type { routing } from "@/i18n/routing";
import type messages from "../messages/en.json";

// Type-safe locales and message keys across next-intl APIs. `useTranslations`
// / `getTranslations` now autocomplete keys and flag typos at build time.
// `en` is the reference catalog; `da` must mirror its shape.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
