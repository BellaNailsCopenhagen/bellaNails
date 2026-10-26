import "server-only"

import nodemailer, { type Transporter } from "nodemailer"

/**
 * Zoho Mail SMTP — the only file that names the mail vendor. Env-guarded like
 * every adapter: absent creds make a send a logged no-op (returns `skipped`)
 * so the app boots and booking never fails on a missing key. Knows no app
 * constants — `from`/`to`/`subject`/bodies are all passed in.
 */

export type EmailMessage = {
  from: string
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  // Optional iCalendar invite (text/calendar) — nodemailer attaches it as an
  // alternative part so mail clients offer "add to calendar".
  calendar?: { content: string; method?: string; filename?: string }
}

// `error` is a non-PII failure CODE/name (never the SMTP message, which can echo
// the recipient address) — safe to persist for diagnosing failed sends.
export type EmailResult = { ok: boolean; skipped?: boolean; error?: string }

function config() {
  const user = process.env.ZOHO_SMTP_USER
  const pass = process.env.ZOHO_SMTP_PASS
  if (!user || !pass) {
    return null
  }
  const host = process.env.ZOHO_SMTP_HOST || "smtp.zoho.eu"
  const port = Number(process.env.ZOHO_SMTP_PORT) || 465

  return { host, port, user, pass }
}

// One transport per config — SMTP verify + connection pooling live here.
let cached: { transport: Transporter; key: string } | null = null
function transport(cfg: NonNullable<ReturnType<typeof config>>): Transporter {
  const key = `${cfg.host}:${cfg.port}:${cfg.user}`
  if (cached?.key !== key) {
    cached = {
      key,
      transport: nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465, // implicit TLS on 465, STARTTLS otherwise
        auth: { user: cfg.user, pass: cfg.pass },
      }),
    }
  }

  return cached.transport
}

let warned = false

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const cfg = config()
  if (!cfg) {
    if (!warned) {
      console.warn("[email] ZOHO_SMTP_USER/PASS unset — emails are a no-op")
      warned = true
    }

    return { ok: false, skipped: true }
  }

  try {
    await transport(cfg).sendMail({
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo: msg.replyTo,
      icalEvent: msg.calendar
        ? {
            method: msg.calendar.method ?? "PUBLISH",
            filename: msg.calendar.filename ?? "invite.ics",
            content: msg.calendar.content,
          }
        : undefined,
    })

    return { ok: true }
  } catch (error) {
    // Log the failure shape only, never `.message` — an SMTP rejection can echo
    // the recipient address (PII) in its response text.
    const info =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : error instanceof Error
          ? error.name
          : "unknown"
    console.error("[email] send failed —", info)

    return { ok: false, error: String(info) }
  }
}
