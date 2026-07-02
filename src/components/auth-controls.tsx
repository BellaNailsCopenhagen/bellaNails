import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

/**
 * Sign-in / sign-up actions when signed out, avatar menu when signed in.
 * Clerk's buttons wrap our brand Button as their trigger; redirects use the
 * locale-aware URLs set on ClerkProvider. This will move into SiteHeader once
 * that primitive lands (Phase 1 leftover).
 */
export function AuthControls() {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton>
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton>
          <Button size="sm">Sign up</Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
