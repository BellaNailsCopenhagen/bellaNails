import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

type AuthControlsProps = {
  signInLabel: string;
  signUpLabel: string;
};

/**
 * Sign-in / sign-up actions when signed out, avatar menu (with "Manage
 * account") when signed in. Clerk's buttons wrap our brand Button as their
 * trigger; redirects use the locale-aware URLs set on ClerkProvider. Labels are
 * passed in so the header can localize them via next-intl.
 */
export function AuthControls({ signInLabel, signUpLabel }: AuthControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton>
          <Button variant="ghost" size="sm">
            {signInLabel}
          </Button>
        </SignInButton>
        <SignUpButton>
          <Button size="sm">{signUpLabel}</Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
