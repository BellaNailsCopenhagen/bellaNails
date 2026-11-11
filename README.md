# Bella Nails

Next.js nail-studio site: public booking, an owner-only `/admin` CRM,
and GDPR-compliant client media. Stack: Supabase 
· Supabase Storage · Zoho · Vercel.

## Getting started

**→ Follow [docs/SETUP.md](docs/SETUP.md)** — the from-zero runbook: prerequisites,
every vendor account + exact settings + where each env var goes, database
bootstrap, owner setup, run, and deploy. Written so any dev can stand the project
up without prior context.

Quick version once `.env.local` is filled and the DB is bootstrapped:

```bash
corepack enable      # use the pinned pnpm
pnpm install
pnpm dev             # http://localhost:3000
```

## Key docs

- [docs/architecture.md](docs/architecture.md) — the four layers, the rules lint enforces, and where new code goes
- [docs/SETUP.md](docs/SETUP.md) — setup / restart runbook
- [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) — vendor details, schema, auth gotchas
- [docs/archive/PLAN.md](docs/archive/PLAN.md) — build roadmap (historical)
- [docs/archive/PROJECT_BIBLE.md](docs/archive/PROJECT_BIBLE.md) — decisions & architecture (stale snapshot)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
