import { UserProfile } from "@clerk/nextjs";

// Catch-all so Clerk owns its sub-routes (/account/security, etc.). The proxy
// requires a signed-in user for /[locale]/account, so UserProfile always has a
// user. `path` is locale-prefixed to match the route.
export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <UserProfile path={`/${locale}/account`} />
    </main>
  );
}
