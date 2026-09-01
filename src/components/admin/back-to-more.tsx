import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { routes } from "@/shared/routes"

/** Every page under admin "More" is reached from there and nowhere else, so
    they all carry the same way back. */
export function BackToMore() {
  return (
    <Link
      href={routes.admin.more}
      className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" />
      More
    </Link>
  )
}
