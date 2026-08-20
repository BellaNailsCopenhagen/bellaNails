import { Eyebrow } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"

/**
 * Placeholder for admin tabs whose feature ships in a later task (New,
 * Clients, Services, More). Keeps the shell installable and navigable now
 * without pretending the feature exists.
 */
export function AdminComingSoon({ section }: { section: string }) {
  return (
    <div className="space-y-8">
      <Eyebrow>{section}</Eyebrow>
      <EmptyState
        title="Coming soon"
        body="This part of the studio app isn’t built yet. It arrives in a later step of the admin rollout."
      />
    </div>
  )
}
