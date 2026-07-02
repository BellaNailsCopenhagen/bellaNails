import { SignUp } from "@clerk/nextjs";

// Catch-all so Clerk can own its sub-routes (/sign-up/verify-email-address, etc.).
// No translations here, so no setRequestLocale; Clerk's <SignUp> is dynamic.
export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <SignUp />
    </main>
  );
}
