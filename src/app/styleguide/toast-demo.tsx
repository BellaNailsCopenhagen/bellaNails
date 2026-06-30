"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Client-only trigger buttons for the four sonner variants — toasts need a
 * click handler, so this is split out of the (server) styleguide page.
 */
export function ToastDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        onClick={() => toast.success("Session reserved", {
          description: "We've emailed your confirmation.",
        })}
      >
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.info("Your slot is held for 10 minutes.")}
      >
        Info
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.warning("That add-on isn't available with this service.")}
      >
        Warning
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Payment could not be authorised.")}
      >
        Error
      </Button>
    </div>
  );
}
