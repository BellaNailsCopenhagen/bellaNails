import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/shared/cn"

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 border-b border-border bg-transparent px-0 py-3 font-functional text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&:user-invalid]:border-destructive",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
