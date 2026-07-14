import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-none border font-functional uppercase whitespace-nowrap",
  {
    variants: {
      variant: {
        outline: "border-border text-muted-foreground bg-transparent",
      },
      size: {
        default: "px-4 py-2.5 text-xs font-medium tracking-widest-lux",
        sm: "px-3 py-2 text-[11px] font-medium tracking-[0.02em]",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
)

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>

function Badge({
  className,
  variant = "outline",
  size = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
export type { BadgeProps }
