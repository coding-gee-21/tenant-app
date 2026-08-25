# Chuka Rentals Phase 3 setup

## Database

1. Open Supabase SQL Editor.
2. Run `supabase/migrations/20260820_student_journey.sql` once.
3. Confirm that `saved_searches` and `viewing_requests` appear in Table Editor.

## Local project

1. Stop every running Next.js server with `Ctrl + C`. If an old server remains, use `taskkill /PID <PID> /F`.
2. Keep the old project as a backup and extract this ZIP into a new folder.
3. Copy the old `.env.local` into the new folder.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open the Local URL printed by Next.js.

## Test checklist

- Home shows at most five property cards and then **View all rentals**.
- `/rentals` shows every approved rental and supports filtering/sorting.
- Save a property and confirm it appears at `/account/saved`.
- Select two properties, open `/compare`, and verify the comparison table.
- Save a search and confirm it appears at `/account/searches`.
- Request a viewing from a property page and confirm it appears at `/account/viewings`.
- Sign in as the property owner and manage it at `/landlord/viewings`.
- Confirm `/safety` and the mobile bottom navigation work.
- On the landlord dashboard, confirm each listing displays a quality percentage.

## Deployment

After local testing, commit and push the extracted project to the repository connected to Vercel. Do not change the existing Vercel environment variables. Test `/rentals`, `/compare`, `/account/saved`, `/account/viewings`, and `/landlord/viewings` on the deployed URL.
