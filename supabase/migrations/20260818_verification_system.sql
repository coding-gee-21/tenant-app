-- Chuka Rentals: Trust & Verification System
-- Safe to run against an existing project. Uses IF NOT EXISTS for additive changes.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE landlords
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;

-- Normalize nulls without changing existing approved/available listings.
UPDATE landlords SET verification_status = 'unverified' WHERE verification_status IS NULL;
UPDATE properties SET verification_status = CASE
  WHEN COALESCE(is_verified, false) = true THEN 'verified'
  ELSE 'unverified'
END WHERE verification_status IS NULL;

CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('landlord', 'property')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  full_name TEXT,
  phone_number TEXT,
  role TEXT,
  notes TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT verification_request_target_check CHECK (
    (verification_type = 'landlord' AND property_id IS NULL)
    OR
    (verification_type = 'property' AND property_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status
  ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_landlord
  ON verification_requests(landlord_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_property
  ON verification_requests(property_id);

-- Prevent multiple simultaneous pending requests for the same target.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_landlord_verification
  ON verification_requests(landlord_id, verification_type)
  WHERE verification_type = 'landlord' AND status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_property_verification
  ON verification_requests(property_id, verification_type)
  WHERE verification_type = 'property' AND status = 'pending';

ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own verification requests" ON verification_requests;
CREATE POLICY "Users can create own verification requests"
ON verification_requests FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = landlord_id
  AND (
    verification_type = 'landlord'
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id
      AND (p.landlord_id = auth.uid() OR p.user_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Users can view own verification requests" ON verification_requests;
CREATE POLICY "Users can view own verification requests"
ON verification_requests FOR SELECT
TO authenticated
USING (auth.uid() = landlord_id);

-- Only the server-side admin API uses the service role for review operations.
-- Do not create a client-writable admin policy.

-- Keep updated_at current for direct database updates too.
CREATE OR REPLACE FUNCTION update_verification_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verification_requests_updated_at ON verification_requests;
CREATE TRIGGER verification_requests_updated_at
BEFORE UPDATE ON verification_requests
FOR EACH ROW
EXECUTE FUNCTION update_verification_requests_updated_at();

COMMENT ON TABLE verification_requests IS 'Audit trail and workflow state for Chuka Rentals landlord/property verification.';
COMMENT ON COLUMN landlords.verification_status IS 'unverified, pending, verified, rejected, suspended';
COMMENT ON COLUMN properties.verification_status IS 'unverified, pending, verified, rejected, suspended';

-- Separate publication state from vacancy state. Existing `status` is still used by the landlord dashboard
-- for vacancy/occupancy, while listing_status controls whether a property is publicly published.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS listing_status TEXT;

UPDATE properties
SET listing_status = CASE
  WHEN status = 'rejected' THEN 'rejected'
  ELSE 'approved'
END
WHERE listing_status IS NULL;

ALTER TABLE properties
  ALTER COLUMN listing_status SET DEFAULT 'pending';

UPDATE properties
SET verification_status = 'verified'
WHERE COALESCE(is_verified, false) = true
  AND verification_status <> 'verified';

CREATE INDEX IF NOT EXISTS idx_properties_listing_status ON properties(listing_status);
