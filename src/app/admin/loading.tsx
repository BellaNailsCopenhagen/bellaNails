import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level loading for the admin dashboard (a per-request authed read).
 * Mirrors the dashboard layout — eyebrow + display heading, then the count
 * card — so the shell doesn't jump when data arrives.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-11 w-64" />
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
    </div>
  )
}
