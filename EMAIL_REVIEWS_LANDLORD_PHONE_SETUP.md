# Email Reviews and Landlord Phone Verification

This release separates student and landlord verification:

- Students confirm their email before publishing or editing a review.
- Students are never required to request an SMS.
- Landlords confirm both email and phone before opening the landlord portal.
- Only landlord-onboarding accounts can call the OTP send/verify APIs.
- Property writes require a landlord role and a verified phone at database level.

## 1. Run the Supabase migration

Open Supabase -> SQL Editor -> New query. Copy and run:

`supabase/migrations/20260824_email_reviews_landlord_phone.sql`

Run it once after the earlier account-role and phone-verification migrations.

## 2. Enable email confirmation

In Supabase open Authentication -> Sign In / Providers -> Email and enable
Confirm email.

In Authentication -> URL Configuration set the deployed site as Site URL and
allow both the deployed URL and `http://localhost:3000/**` as redirect URLs.

## 3. Sandbox presentation settings

Keep these only in `.env.local` and Vercel Environment Variables. Never commit
their values:

```env
AT_USERNAME=sandbox
AT_API_KEY=replace_with_a_new_sandbox_key
PHONE_OTP_SECRET=replace_with_a_long_random_secret
```

Do not set `AT_SENDER_ID` for the sandbox presentation. Africa's Talking
Sandbox OTP messages are viewed through the Sandbox simulator, not a normal
phone inbox.

## 4. Test student flow

1. Register a new student account.
2. Confirm the email using the received link.
3. Log in and publish a property review.
4. Confirm no phone-verification page is shown.
5. Try with an unconfirmed email and confirm the review is rejected.

## 5. Test landlord flow

1. Register and confirm another email account.
2. Open `/landlord` and click Become a Landlord.
3. Confirm the phone-verification page opens.
4. Request an OTP and complete it using the Africa's Talking simulator.
5. Return to `/landlord`, finish onboarding, and publish a test listing.
6. Confirm a normal student cannot open `/phone-verification` and send an OTP.

## 6. Production handover

If the school activates production SMS later, replace the sandbox username and
key, add its approved `AT_SENDER_ID`, redeploy Vercel, and test Safaricom and
Airtel delivery. No review or database redesign will be needed.
