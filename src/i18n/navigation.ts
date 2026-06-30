import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware navigation APIs. Use these `Link`/`redirect`/`usePathname`/
 * `useRouter`/`getPathname` everywhere instead of the ones from `next/*` so
 * the active locale prefix is preserved automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
