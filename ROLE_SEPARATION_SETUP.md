# Chuka Rentals role separation setup

## 1. Run the Supabase migration

1. Open your Supabase project.
2. Select **SQL Editor** in the left sidebar.
3. Select **New query**.
4. Open `supabase/migrations/20260820_account_roles_and_reviews.sql` from this project.
5. Copy the complete SQL file into the query editor.
6. Select **Run** once.
7. Confirm that the result says **Success**.

This preserves existing administrators and automatically marks accounts that already own properties as landlords.

## 2. Replace your local project

1. Stop the development server with `Ctrl + C`.
2. Keep a backup of your current project folder.
3. Extract the updated ZIP.
4. Copy your existing `.env.local` into the extracted project. Do not upload or share this file.
5. Open Command Prompt in the extracted folder.
6. Run `npm install`.
7. Run `npm run dev`.
8. Open `http://localhost:3000`.

## 3. Test each account type

### Student

1. Register a new account.
2. Open **Student Account** from the menu.
3. Open a property and attempt a review.
4. Verify the phone when prompted.
5. Submit the review and confirm it appears under **My Reviews**.
6. Submit another review for the same property; it should update the original rather than create a duplicate.

### Landlord

1. Sign in using a normal account and verify its phone.
2. Open **Landlord Portal** from the menu.
3. Select **Become a Landlord**.
4. Confirm that `/landlord/dashboard` opens.
5. Add a property and confirm it appears in the landlord dashboard.

### Route protection

1. Sign in with a fresh student account.
2. Manually enter `/landlord/dashboard`.
3. Confirm that the site redirects to `/landlord`.
4. Manually enter `/add-property` and confirm the same protection.
5. Sign out and open `/account`; confirm that the site redirects to login.

### Administrator

1. Open `/admin/login`.
2. Sign in with the configured administrator email.
3. Confirm that `/admin/dashboard` still works independently.

## 4. Deploy

After all local tests pass, commit/push the updated project to the repository connected to Vercel. Verify that the Vercel environment variables are unchanged, then test the four protected routes on the deployed site.
