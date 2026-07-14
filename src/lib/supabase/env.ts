/**
 * Asserts a Supabase env var is present. Callers MUST pass the value via a
 * *static* `process.env.NEXT_PUBLIC_…` member access (not a dynamic lookup) so
 * Next inlines it into the client bundle — `process.env[name]` would be
 * `undefined` in the browser. We pass `name` only for the error message.
 */
export function assertEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    )
  }
  return value
}
