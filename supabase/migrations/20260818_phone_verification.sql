-- Chuka Rentals: Phone Number Verification
-- OTPs are temporary server-side records. The client never reads or writes
-- the verification-code table directly.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_user
  ON phone_verification_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_phone
  ON phone_verification_codes(phone_number);

CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_created
  ON phone_verification_codes(created_at);

ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;

-- No client policies are created intentionally. The Next.js API routes use
-- the Supabase service-role client after authenticating the user's access token.
COMMENT ON TABLE phone_verification_codes IS
  'Temporary OTP records for Chuka Rentals phone verification. OTP values are stored as HMAC hashes.';
COMMENT ON COLUMN profiles.phone_verified IS
  'True only after the user successfully verifies an SMS OTP sent to phone_number.';
