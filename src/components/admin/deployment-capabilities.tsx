"use client"

import { createContext, useContext, type ReactNode } from "react"

/**
 * What this deployment can actually do — for admin controls that would
 * otherwise look live while the key behind them is missing.
 *
 * A context rather than a prop because these controls sit deep inside client
 * trees with four separate render sites, and an optional prop a new caller
 * forgets to pass is precisely how "looks like a button, always errors" comes
 * back. Every default is false, so a missing provider hides a control rather
 * than promising one.
 */
export type DeploymentCapabilities = {
  /** `GOOGLE_REVIEW_URL` is set, so "request review" has something to send. */
  reviewLink: boolean
}

const NONE: DeploymentCapabilities = { reviewLink: false }

const Capabilities = createContext<DeploymentCapabilities>(NONE)

export function DeploymentCapabilitiesProvider({
  value,
  children,
}: {
  value: DeploymentCapabilities
  children: ReactNode
}) {
  return <Capabilities value={value}>{children}</Capabilities>
}

export function useDeploymentCapabilities(): DeploymentCapabilities {
  return useContext(Capabilities)
}
