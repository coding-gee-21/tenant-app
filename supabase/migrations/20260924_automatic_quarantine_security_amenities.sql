-- University recommendation release:
-- 1. One authenticated report temporarily removes a listing from public view.
-- 2. Security arrangements support multiple selections.
-- 3. Existing single-value security records remain compatible.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS auto_hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS security_amenities TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.properties
SET
  is_flagged = COALESCE(is_flagged, FALSE),
  moderation_status = CASE
    WHEN listing_status = 'suspended' THEN 'suspended'
    WHEN COALESCE(is_flagged, FALSE) THEN 'under_review'
    ELSE 'public'
  END;

UPDATE public.properties
SET security_amenities = CASE
  WHEN security_system = 'Biometrics' THEN ARRAY['Biometric Access']
  ELSE ARRAY[security_system]
END
WHERE COALESCE(array_length(security_amenities, 1), 0) = 0
  AND security_system IN (
    'Security Guard',
    'Gated Compound',
    'Biometrics',
    'Biometric Access'
  );

ALTER TABLE public.properties
  ALTER COLUMN is_flagged SET DEFAULT FALSE,
  ALTER COLUMN is_flagged SET NOT NULL,
  ALTER COLUMN moderation_status SET DEFAULT 'public',
  ALTER COLUMN moderation_status SET NOT NULL,
  ALTER COLUMN security_amenities SET DEFAULT '{}',
  ALTER COLUMN security_amenities SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_moderation_status_check'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_moderation_status_check
      CHECK (moderation_status IN ('public', 'under_review', 'suspended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_security_amenities_check'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_security_amenities_check
      CHECK (
        security_amenities <@ ARRAY[
          'Security Guard',
          'Gated Compound',
          'Biometric Access'
        ]::TEXT[]
      );
  END IF;
END
$$;

ALTER TABLE public.property_reports
  ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issue_type TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS admin_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Some older databases created reporter_id or reviewed_by as TEXT. Remove
-- objects that can depend on those columns before normalising their types.
DROP FUNCTION IF EXISTS public.report_property_and_quarantine(UUID, TEXT, TEXT);
DROP INDEX IF EXISTS public.property_reports_one_active_per_student;
DROP POLICY IF EXISTS "Anyone can report" ON public.property_reports;
DROP POLICY IF EXISTS "Authenticated students can report" ON public.property_reports;

CREATE OR REPLACE FUNCTION public._cueaf_resolve_auth_user_id(
  legacy_user_id TEXT
)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT users.id
  FROM auth.users AS users
  WHERE users.id::TEXT = NULLIF(BTRIM(legacy_user_id), '')
  LIMIT 1;
$$;

DO $$
DECLARE
  reporter_id_type TEXT;
  reviewed_by_type TEXT;
BEGIN
  SELECT columns.udt_name
  INTO reporter_id_type
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'property_reports'
    AND columns.column_name = 'reporter_id';

  IF reporter_id_type IS DISTINCT FROM 'uuid' THEN
    ALTER TABLE public.property_reports
      ALTER COLUMN reporter_id DROP DEFAULT,
      ALTER COLUMN reporter_id DROP NOT NULL;

    ALTER TABLE public.property_reports
      ALTER COLUMN reporter_id TYPE UUID
      USING public._cueaf_resolve_auth_user_id(reporter_id::TEXT);
  END IF;

  SELECT columns.udt_name
  INTO reviewed_by_type
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'property_reports'
    AND columns.column_name = 'reviewed_by';

  IF reviewed_by_type IS DISTINCT FROM 'uuid' THEN
    ALTER TABLE public.property_reports
      ALTER COLUMN reviewed_by DROP DEFAULT,
      ALTER COLUMN reviewed_by DROP NOT NULL;

    ALTER TABLE public.property_reports
      ALTER COLUMN reviewed_by TYPE UUID
      USING public._cueaf_resolve_auth_user_id(reviewed_by::TEXT);
  END IF;
END
$$;

UPDATE public.property_reports
SET
  reporter_id = COALESCE(
    reporter_id,
    public._cueaf_resolve_auth_user_id(reported_by::TEXT)
  ),
  description = COALESCE(description, reason),
  admin_status = COALESCE(NULLIF(admin_status, ''), status, 'pending');

-- Deleted accounts or invalid legacy identifiers must not prevent the foreign
-- keys from being installed.
UPDATE public.property_reports AS reports
SET reporter_id = NULL
WHERE reports.reporter_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users AS users
    WHERE users.id = reports.reporter_id
  );

UPDATE public.property_reports AS reports
SET reviewed_by = NULL
WHERE reports.reviewed_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users AS users
    WHERE users.id = reports.reviewed_by
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'property_reports_reporter_id_fkey'
      AND conrelid = 'public.property_reports'::REGCLASS
  ) THEN
    ALTER TABLE public.property_reports
      ADD CONSTRAINT property_reports_reporter_id_fkey
      FOREIGN KEY (reporter_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'property_reports_reviewed_by_fkey'
      AND conrelid = 'public.property_reports'::REGCLASS
  ) THEN
    ALTER TABLE public.property_reports
      ADD CONSTRAINT property_reports_reviewed_by_fkey
      FOREIGN KEY (reviewed_by)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

DROP FUNCTION public._cueaf_resolve_auth_user_id(TEXT);

ALTER TABLE public.property_reports
  ALTER COLUMN admin_status SET DEFAULT 'pending',
  ALTER COLUMN admin_status SET NOT NULL;

WITH duplicate_pending_reports AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY property_id, reporter_id
      ORDER BY created_at, id
    ) AS report_number
  FROM public.property_reports
  WHERE reporter_id IS NOT NULL
    AND admin_status = 'pending'
)
UPDATE public.property_reports AS reports
SET admin_status = 'duplicate'
FROM duplicate_pending_reports AS duplicates
WHERE reports.id = duplicates.id
  AND duplicates.report_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS property_reports_one_active_per_student
  ON public.property_reports(property_id, reporter_id)
  WHERE reporter_id IS NOT NULL AND admin_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_properties_public_moderation
  ON public.properties(listing_status, moderation_status, is_flagged);

CREATE INDEX IF NOT EXISTS idx_property_reports_admin_queue
  ON public.property_reports(admin_status, created_at DESC);

-- Direct inserts remain blocked by RLS. Students must use the function below,
-- which records the report and quarantines the property in one transaction.

CREATE OR REPLACE FUNCTION public.report_property_and_quarantine(
  p_property_id UUID,
  p_issue_type TEXT,
  p_description TEXT
)
RETURNS TABLE (
  report_id UUID,
  moderation_status TEXT,
  hidden_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_property public.properties%ROWTYPE;
  new_report_id UUID;
  report_time TIMESTAMPTZ := NOW();
  combined_reason TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before reporting a property.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = current_user_id
      AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Confirm your email before reporting a property.';
  END IF;

  IF LENGTH(TRIM(COALESCE(p_description, ''))) < 10 THEN
    RAISE EXCEPTION 'Provide at least 10 characters describing the issue.';
  END IF;

  IF LENGTH(TRIM(COALESCE(p_description, ''))) > 1000 THEN
    RAISE EXCEPTION 'The report description must not exceed 1000 characters.';
  END IF;

  SELECT *
  INTO current_property
  FROM public.properties
  WHERE id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found.';
  END IF;

  IF current_property.user_id = current_user_id
    OR current_property.landlord_id = current_user_id THEN
    RAISE EXCEPTION 'A landlord cannot report their own property.';
  END IF;

  IF current_property.listing_status <> 'approved' THEN
    RAISE EXCEPTION 'Only a published property can be reported.';
  END IF;

  IF current_property.is_flagged
    OR current_property.moderation_status <> 'public' THEN
    RAISE EXCEPTION 'This property is already under administrator review.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.property_reports
    WHERE property_id = p_property_id
      AND reporter_id = current_user_id
      AND created_at >= NOW() - INTERVAL '30 days'
  ) THEN
    RAISE EXCEPTION 'You have already reported this property recently.';
  END IF;

  combined_reason := CONCAT(
    LEFT(TRIM(COALESCE(p_issue_type, 'Reported issue')), 100),
    ': ',
    TRIM(p_description)
  );

  INSERT INTO public.property_reports (
    property_id,
    reporter_id,
    reason,
    issue_type,
    description,
    status,
    admin_status
  )
  VALUES (
    p_property_id,
    current_user_id,
    combined_reason,
    LEFT(TRIM(COALESCE(p_issue_type, 'Reported issue')), 100),
    TRIM(p_description),
    'pending',
    'pending'
  )
  RETURNING id INTO new_report_id;

  UPDATE public.properties
  SET
    is_flagged = TRUE,
    moderation_status = 'under_review',
    flag_reason = combined_reason,
    flagged_at = report_time,
    auto_hidden_at = report_time
  WHERE id = p_property_id;

  RETURN QUERY
  SELECT new_report_id, 'under_review'::TEXT, report_time;
END;
$$;

REVOKE ALL ON FUNCTION public.report_property_and_quarantine(UUID, TEXT, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_property_and_quarantine(UUID, TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.report_property_and_quarantine(UUID, TEXT, TEXT)
IS 'Atomically records an authenticated report and quarantines the property from public discovery.';
