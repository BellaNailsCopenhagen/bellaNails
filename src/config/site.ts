/** Canonical site origin, trailing-slash-normalized. One constant so the
    layout metadata and URLs baked into emails can never disagree. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bellanails.dk"
).replace(/\/+$/, "")
