"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { H2, BodySm } from "@/components/ui/typography"
import {
  sendEmailOtp,
  signInWithGoogle,
  verifyEmailOtp,
} from "@/lib/identity/auth-actions"

/**
 * Supabase Auth login: Google OAuth + passwordless email OTP. `next` is where to
 * land after auth (already validated to a local path by the page).
 */
export function SupabaseLoginForm({ next = "/" }: { next?: string }) {
  const [step, setStep] = useState<"email" | "otp">("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const google = async () => {
    setPending(true)
    setError(null)
    const { error } = await signInWithGoogle(next)
    if (error) {
      setError(error.message)
      setPending(false)
    }
    // On success the browser navigates to Google — no further work here.
  }

  const send = async () => {
    setPending(true)
    setError(null)
    const { error } = await sendEmailOtp(email)
    setPending(false)
    if (error) setError(error.message)
    else setStep("otp")
  }

  const verify = async () => {
    setPending(true)
    setError(null)
    const { error } = await verifyEmailOtp(email, otp)
    if (error) {
      setError(error.message)
      setPending(false)
    } else {
      window.location.assign(next)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1 text-center">
        <H2>Log in</H2>
        <BodySm className="text-xs">Continue with Google or your email.</BodySm>
      </div>

      <Button className="w-full" disabled={pending} onClick={google}>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux">
          or
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
            placeholder="you@email.com"
            required
          />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={pending || !email}
          >
            {pending ? "Sending…" : "Email me a code"}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            verify()
          }}
        >
          <BodySm className="text-xs">
            Enter the 6-digit code sent to {email}.
          </BodySm>
          <Input
            inputMode="numeric"
            name="otp"
            autoComplete="one-time-code"
            value={otp}
            onValueChange={setOtp}
            placeholder="123456"
            required
          />
          <Button type="submit" className="w-full" disabled={pending || !otp}>
            {pending ? "Verifying…" : "Verify & continue"}
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
            Use a different email
          </button>
        </form>
      )}

      {error ? (
        <BodySm className="text-xs text-destructive">{error}</BodySm>
      ) : null}
    </div>
  )
}
