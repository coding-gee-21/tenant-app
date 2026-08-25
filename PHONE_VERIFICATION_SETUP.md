# Chuka Rentals — Phone Verification Implementation

This patch implements SMS phone verification using Africa's Talking, following the uploaded
`phone_verification.pdf` architecture while adapting it to the existing Next.js + Supabase app.

## What changed

- Added `africastalking` dependency.
- Added `lib/africasTalking.js`.
- Added `/api/phone-verification/send`.
- Added `/api/phone-verification/verify`.
- Added `/api/phone-verification/status`.
- Added `/phone-verification` UI.
- Added `profiles.phone_number`, `profiles.phone_verified`, and `profiles.phone_verified_at`.
- Added `phone_verification_codes` temporary OTP table.
- Added a 5-minute OTP expiry.
- Added 60-second resend protection.
- Added a maximum of 3 OTP requests per user/phone per hour.
- Added a maximum of 5 wrong-code attempts.
- OTPs are stored as HMAC hashes rather than plaintext.
- Landlords must verify a phone before submitting a property listing.
- Students/users must verify a phone before posting a review.
- The landlord dashboard shows a verification banner.

## Required setup

1. Run:
   npm install africastalking

2. In Supabase SQL Editor, run:
   `supabase/migrations/20260818_phone_verification.sql`

3. Create an Africa's Talking account/app and obtain the API key. For sandbox testing,
   the SDK uses username `sandbox`.

4. Add these variables to `.env.local`:
   AT_USERNAME=sandbox
   AT_API_KEY=YOUR_AFRICAS_TALKING_API_KEY
   PHONE_OTP_SECRET=YOUR_LONG_RANDOM_SECRET

   Optional production sender ID:
   AT_SENDER_ID=YOUR_REGISTERED_SENDER_ID

5. Restart Next.js:
   npm run dev

## Test flow

1. Log in to Chuka Rentals.
2. Open `/phone-verification`.
3. Enter the Kenyan test phone number in the format accepted by the page.
4. Click Send Verification Code.
5. Enter the 6-digit OTP received by SMS.
6. Confirm the page reports Phone verified.
7. Open `/add-property`: the verified number becomes the listing contact.
8. Open a property and try to post a review: the verified-phone gate will now allow it.

## Important architecture note

The uploaded guide demonstrates an in-memory Map for a simple Node.js example and explicitly says
a Redis/database store should be used in production. This implementation uses Supabase for OTP
records because the existing Chuka Rentals app is already serverless/Next.js and should not depend
on process memory surviving between requests or deployments.

The existing email/password Supabase authentication flow has not been replaced. Phone verification
is currently a trust gate for the two actions that matter most: publishing a landlord listing and
posting a student review. After this is tested successfully, the phone step can be moved directly
into the registration journey if desired.
