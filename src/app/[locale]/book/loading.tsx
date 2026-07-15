import { Container, Section } from "@/components/layout/container"
import { PageHeaderSkeleton } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"

/** Streamed while the booking step resolves its catalog reads. */
export default function BookLoading() {
  return (
    <main className="flex flex-1 flex-col">
      <Section>
        <Container className="max-w-4xl">
          <PageHeaderSkeleton />
          <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
            <div className="w-full space-y-4 md:max-w-[25rem]">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <Skeleton className="h-80 w-full rounded-lg md:max-w-[22.5rem]" />
          </div>
        </Container>
      </Section>
    </main>
  )
}
