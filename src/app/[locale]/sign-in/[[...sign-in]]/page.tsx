import { SignIn } from "@clerk/nextjs"

// Catch-all so Clerk can own its sub-routes (/sign-in/factor-one, etc.).
// No translations here, so no setRequestLocale; Clerk's <SignIn> is dynamic.
export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <SignIn />
    </main>
  )
}
