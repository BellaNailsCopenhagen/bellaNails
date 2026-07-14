import { cn } from "@/lib/utils"

/**
 * Container — the horizontal layout shell. Caps content width and applies the
 * consistent gutter every page section shares. Compose page sections inside it.
 */
function Container({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="container"
      className={cn("mx-auto w-full max-w-6xl px-6 sm:px-8", className)}
      {...props}
    />
  )
}

/**
 * Section — vertical rhythm wrapper for a page section. Pair with Container for
 * the horizontal gutter: `<Section><Container>…</Container></Section>`.
 */
function Section({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="section"
      className={cn("py-16 sm:py-24", className)}
      {...props}
    />
  )
}

export { Container, Section }
