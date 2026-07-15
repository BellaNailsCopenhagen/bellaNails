"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * App-wide TanStack Query provider (Phase 5, mounted with the first real
 * consumers). The client lives in state so one instance survives re-renders
 * but is never shared between requests during SSR.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Personal data on an otherwise-static site: fresh enough for a
            // browsing session, no surprise refetch storms on focus.
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
