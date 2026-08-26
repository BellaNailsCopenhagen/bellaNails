import { STUDIO_NAME } from "@/config/studio"

/**
 * The transactional booking emails' copy (natural da / en, not
 * machine-translated). Split out from the renderers so a wording change never
 * touches the HTML/text layout, and vice versa. Cancel/reschedule intros vary
 * by who acted — the client from their manage page, or the studio.
 */

export type Kind = "confirmed" | "cancelled" | "moved" | "reminder"

export const COPY = {
  da: {
    greeting: (n: string | null) => (n ? `Hej ${n},` : "Hej,"),
    labels: {
      service: "Behandling",
      addons: "Tillæg",
      date: "Dato",
      time: "Tidspunkt",
      previous: "Tidligere",
      newTime: "Ny tid",
      price: "Pris",
    },
    at: (date: string, time: string) => `${date} kl. ${time}`,
    subject: {
      confirmed: `Din booking hos ${STUDIO_NAME} er bekræftet`,
      cancelled: `Din booking hos ${STUDIO_NAME} er aflyst`,
      moved: `Din booking hos ${STUDIO_NAME} er flyttet`,
      reminder: `Påmindelse: din tid hos ${STUDIO_NAME} i morgen`,
    },
    intro: {
      confirmed: "Tak for din booking — din tid er hermed bekræftet.",
      cancelled: {
        client: "Du har aflyst din tid. Du er altid velkommen til at booke en ny.",
        studio:
          "Salonen har aflyst din tid. Du er altid velkommen til at booke en ny.",
      },
      moved: {
        client: "Du har flyttet din tid — her er de nye detaljer.",
        studio: "Salonen har flyttet din tid. Her er de nye detaljer.",
      },
      reminder: "En venlig påmindelse om din tid i morgen. Vi glæder os til at se dig.",
    },
    payment: "Betaling foregår i salonen.",
    policy: "Ombooking eller aflysning kan ske indtil 24 timer før din tid.",
    manageCta: "Flyt eller aflys din tid",
    reply: "Har du spørgsmål, så svar blot på denne e-mail.",
  },
  en: {
    greeting: (n: string | null) => (n ? `Hi ${n},` : "Hi,"),
    labels: {
      service: "Service",
      addons: "Add-ons",
      date: "Date",
      time: "Time",
      previous: "Previous",
      newTime: "New time",
      price: "Price",
    },
    at: (date: string, time: string) => `${date} at ${time}`,
    subject: {
      confirmed: `Your booking at ${STUDIO_NAME} is confirmed`,
      cancelled: `Your booking at ${STUDIO_NAME} has been cancelled`,
      moved: `Your booking at ${STUDIO_NAME} has been moved`,
      reminder: `Reminder: your appointment at ${STUDIO_NAME} tomorrow`,
    },
    intro: {
      confirmed: "Thank you for your booking — your appointment is confirmed.",
      cancelled: {
        client:
          "You've cancelled your appointment. You're always welcome to book a new time.",
        studio:
          "The studio has cancelled your appointment. You're always welcome to book a new time.",
      },
      moved: {
        client: "You've rescheduled your appointment — here are the new details.",
        studio: "The studio has rescheduled your appointment. Here are the new details.",
      },
      reminder:
        "A friendly reminder about your appointment tomorrow — we look forward to seeing you.",
    },
    payment: "Payment is collected at the studio.",
    policy: "You can reschedule or cancel up to 24 hours before your appointment.",
    manageCta: "Reschedule or cancel your appointment",
    reply: "Questions? Just reply to this email.",
  },
} as const

export const pick = (locale: string) => (locale === "en" ? COPY.en : COPY.da)
