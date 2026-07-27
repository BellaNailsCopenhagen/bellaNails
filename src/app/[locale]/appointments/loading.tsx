import { Container, Section } from "@/components/layout/container"
import { PageHeaderSkeleton } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"

/** Streamed while MyBookings reads rows + catalog — mirrors the page shape. */
export default function BookingsLoading() {
  return (
    <main className="flex flex-1 flex-col">
      <Section>
        <Container className="max-w-4xl">
          <PageHeaderSkeleton />
          <div className="space-y-6">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-56 w-full rounded-lg" />
            <Skeleton className="h-56 w-full rounded-lg" />
          </div>
        </Container>
      </Section>
    </main>
  )
}
