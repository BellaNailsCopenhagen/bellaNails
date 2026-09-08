// App feature flags. The flags themselves are DECLARED HERE (code is the source
// of truth for what exists + its admin copy) so they always appear in settings,
// no DB seed required; the `feature_flags` table stores only each flag's on/off
// state. Client-safe (no server imports).

export const FEATURE_FLAGS = {
  outsideHoursRequests: "outside_hours_requests",
} as const

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

/** Is this a flag that exists? The union above is erased at runtime, so an
    action taking a `FeatureFlagKey` still receives whatever a caller sends —
    and `feature_flags` would happily store a row nothing ever reads. */
export const isFeatureFlagKey = (value: string): value is FeatureFlagKey =>
  (Object.values(FEATURE_FLAGS) as string[]).includes(value)

/** Static metadata for one flag — the key (identifier, also a translation key),
    its category, and the admin-facing label + description. */
export type FeatureFlagDef = {
  key: FeatureFlagKey
  category: string
  label: string
  description: string
}

/** A flag with its resolved on/off state, for the admin settings list. */
export type FeatureFlag = FeatureFlagDef & { enabled: boolean }

/** The declared flags. Add a flag here to have it appear in App settings. */
export const FEATURE_FLAG_DEFS: FeatureFlagDef[] = [
  {
    key: FEATURE_FLAGS.outsideHoursRequests,
    category: "booking",
    label: "Outside-hours requests",
    description:
      "Let clients request appointment times outside your working hours. You review and approve each one — nothing is booked automatically. Draw the requestable times as “Outside” blocks in Working hours.",
  },
]
