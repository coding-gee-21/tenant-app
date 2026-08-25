This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Chuka Rentals Trust & Verification (18 Aug 2026)

The verification implementation adds separate landlord and property verification workflows, a verification audit table, secure server-side admin review endpoints, and public verification badges.

### Supabase migration
Run the SQL in:

`supabase/migrations/20260818_verification_system.sql`

Run it once in the Supabase SQL Editor. It is designed to be additive to the existing schema.

### Admin access
Add this to `.env.local` (never commit it):

`ADMIN_EMAILS=your-admin-email@example.com`

Multiple admin emails can be comma-separated. As an alternative, set `profiles.role` to `admin` for the authenticated account after the migration has run.

After changing `.env.local`, restart the Next.js server.

### New routes
- `/verification` — landlord verification centre
- `/admin/dashboard` — protected admin verification + listing approval dashboard
- `/account` — protected student account and activity summary
- `/account/reviews` — reviews submitted by the signed-in student
- `/landlord` — phone-verified landlord onboarding
- `/landlord/dashboard` — protected landlord listing dashboard

Run `supabase/migrations/20260820_account_roles_and_reviews.sql` before testing these routes. Complete instructions are in `ROLE_SEPARATION_SETUP.md`.
- `/api/verification` — authenticated landlord verification API
- `/api/admin/verifications` — protected admin verification API
- `/api/admin/properties` — protected listing approval API

### Trust model
Landlord verification and property verification are intentionally separate. A verified landlord does not automatically make every property they submit verified.

Listing publication is also separated from vacancy state through `properties.listing_status`. The existing `properties.status` field can continue to represent availability/occupancy without accidentally hiding approved listings when a landlord changes vacancy.
