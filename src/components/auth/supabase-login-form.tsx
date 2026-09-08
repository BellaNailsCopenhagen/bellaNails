"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { H2, BodySm } from "@/components/ui/typography"
import {
  sendEmailOtp,
  signInWithGoogle,
  verifyEmailOtp,
} from "@/modules/identity/actions"

/**
 * A displayable message for an auth error, or `fallback`.
 *
 * Supabase's own validation errors read well, but a transport failure gets the
 * raw response body stringified into `message` — a 500 with an empty body
 * literally arrives as "{}", which is what the form used to print at the user.
 * So: never trust a 5xx (its body is diagnostics), and never trust a message
 * that is empty or is serialized JSON rather than prose.
 */
function messageOf(error: unknown, fallback: string): string {
  const { message, status } = (error ?? {}) as {
    message?: unknown
    status?: unknown
  }
  if (typeof status === "number" && status >= 500) return fallback
  if (typeof message !== "string") return fallback
  const text = message.trim()
  if (!text || text.startsWith("{") || text.startsWith("[")) return fallback
  return text
}

/**
 * Run a supabase-js auth call and reduce it to an error message, or null on
 * success. It normally *returns* `{ error }`, but when the endpoint replies with
 * an empty body its fetch layer THROWS instead ("Unexpected end of JSON input"),
 * which otherwise escapes as an uncaught rejection and leaves the form stuck.
 * A thrown parse failure is plumbing, so the user gets `fallback`, not its text.
 */
async function attempt(
  run: () => Promise<{ error: unknown }>,
  fallback: string,
): Promise<string | null> {
  try {
    const { error } = await run()
    if (!error) return null
    // AuthRetryableFetchError carries an empty message and logs as "{}" — the
    // name + HTTP status are the only parts that say what actually happened.
    const { name, status } = error as { name?: string; status?: number }
    console.error("[login]", fallback, { name, status, error })
    return messageOf(error, fallback)
  } catch (thrown) {
    console.error("[login] auth call threw", thrown)
    return fallback
  }
}

/**
 * Supabase Auth login: Google OAuth + passwordless email OTP. `next` is where to
 * land after auth (already validated to a local path by the page).
 *
 * Every string comes from the catalogue. This is the one screen standing
 * between a Danish client and a booking, and it used to be entirely English
 * inside a Danish header and footer.
 */
export function SupabaseLoginForm({
  next,
  defaultEmail = "",
}: {
  /** Where to land after auth — a safe local path, locale prefix included. */
  next: string
  /** Prefilled when the visitor just gave us this address (post-booking). */
  defaultEmail?: string
}) {
  const t = useTranslations("login")
  const [step, setStep] = useState<"email" | "otp">("email")
  const [email, setEmail] = useState(defaultEmail)
  const [otp, setOtp] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const google = async () => {
    setPending(true)
    setError(null)
    const failure = await attempt(
      () => signInWithGoogle(next),
      t("googleFailed"),
    )
    // On success the browser navigates to Google — no further work here.
    if (failure) {
      setError(failure)
      setPending(false)
    }
  }

  const send = async () => {
    setPending(true)
    setError(null)
    const failure = await attempt(
      () => sendEmailOtp(email),
      t("sendFailed"),
    )
    setPending(false)
    if (failure) setError(failure)
    else setStep("otp")
  }

  const verify = async () => {
    setPending(true)
    setError(null)
    const failure = await attempt(
      () => verifyEmailOtp(email, otp),
      t("verifyFailed"),
    )
    if (failure) {
      setError(failure)
      setPending(false)
    } else {
      window.location.assign(next)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1 text-center">
        <H2>{t("title")}</H2>
        <BodySm className="text-xs">{t("intro")}</BodySm>
      </div>

      <Button className="w-full" disabled={pending} onClick={google}>
        {t("google")}
      </Button>

      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux">
          {t("or")}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {step === "email" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <Input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onValueChange={setEmail}
            placeholder={t("emailPlaceholder")}
            required
          />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={pending || !email}
          >
            {pending ? t("sending") : t("sendCode")}
          </Button>
          {/* The code step is otherwise only reachable through a successful
              send, stranding anyone whose email arrived late or in a closed
              tab — and anyone holding a code while sending is down. */}
          <button
            type="button"
            disabled={!email}
            onClick={() => {
              setError(null)
              setStep("otp")
            }}
            className="font-functional text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {t("haveCode")}
          </button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            verify()
          }}
        >
          <BodySm className="text-xs">{t("codeSentTo", { email })}</BodySm>
          <Input
            inputMode="numeric"
            name="otp"
            autoComplete="one-time-code"
            value={otp}
            onValueChange={setOtp}
            placeholder={t("codePlaceholder")}
            required
          />
          <Button type="submit" className="w-full" disabled={pending || !otp}>
            {pending ? t("verifying") : t("verify")}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep("email")
              setOtp("")
              setError(null)
            }}
            className="font-functional text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("otherEmail")}
          </button>
        </form>
      )}

      {error ? (
        <BodySm className="text-xs text-destructive">{error}</BodySm>
      ) : null}
    </div>
  )
}
