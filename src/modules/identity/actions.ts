"use client"

import { createSupabaseSessionBrowserClient } from "@/platform/supabase/ssr-browser"

// OAuth returns here; /api/* bypasses the proxy's locale routing.
const CALLBACK_PATH = "/api/auth/callback"

function callbackUrl(next: string): string {
  return `${window.location.origin}${CALLBACK_PATH}?next=${encodeURIComponent(next)}`
}

/**
 * Client-side auth actions over Supabase Auth. The login form calls these; each
 * returns the supabase-js `{ data, error }` result for the caller to handle.
 */
export function signInWithGoogle(next: string) {
  return createSupabaseSessionBrowserClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  })
}

export function sendEmailOtp(email: string) {
  return createSupabaseSessionBrowserClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
}

export function verifyEmailOtp(email: string, token: string) {
  return createSupabaseSessionBrowserClient().auth.verifyOtp({
    email,
    token,
    type: "email",
  })
}

export function signOut() {
  return createSupabaseSessionBrowserClient().auth.signOut()
}
