-- ============================================================
-- CUEAF moderation-state synchronization
--
-- Purpose:
-- 1. Repair approved listings that retained the legacy
--    "suspended" moderation state.
-- 2. Ensure future admin approvals fully restore public access.
-- 3. Ensure future manual suspensions are consistently hidden.
-- 4. Preserve automatically quarantined "under_review" listings.
-- ============================================================

BEGIN;

-- Ensure the required moderation columns exist.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS auto_hidden_at TIMESTAMPTZ;


-- ============================================================
-- ONE-TIME LEGACY REPAIR
--
-- An approved listing must not remain manually suspended.
-- This repairs Kelsha and any other listing with the same
-- contradictory legacy state.
--
-- Automatically reported listings use "under_review", so they
-- are deliberately excluded from this repair.
-- ============================================================

UPDATE public.properties
SET
  is_flagged = FALSE,
  moderation_status = 'public',
  flag_reason = NULL,
  flagged_at = NULL,
  auto_hidden_at = NULL
WHERE listing_status = 'approved'
  AND moderation_status = 'suspended';


-- Keep existing manually suspended listings internally
-- consistent.
UPDATE public.properties
SET
  is_flagged = TRUE,
  moderation_status = 'suspended',
  flag_reason = COALESCE(
    NULLIF(BTRIM(flag_reason), ''),
    'Listing suspended by an administrator'
  ),
  flagged_at = COALESCE(flagged_at, NOW()),
  auto_hidden_at = COALESCE(auto_hidden_at, NOW())
WHERE listing_status = 'suspended';


-- ============================================================
-- PERMANENT SYNCHRONIZATION TRIGGER
--
-- This trigger runs only when listing_status is explicitly
-- included in an UPDATE operation.
--
-- Automatic student reporting does not change listing_status;
-- it changes moderation_status to "under_review". Therefore,
-- automatic quarantine remains active until an administrator
-- explicitly approves the listing.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_property_moderation_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Explicit approval means the property has been reviewed
  -- and should return to public visibility.
  IF NEW.listing_status = 'approved' THEN
    NEW.is_flagged := FALSE;
    NEW.moderation_status := 'public';
    NEW.flag_reason := NULL;
    NEW.flagged_at := NULL;
    NEW.auto_hidden_at := NULL;

  -- Explicit suspension must hide the property completely.
  ELSIF NEW.listing_status = 'suspended' THEN
    NEW.is_flagged := TRUE;
    NEW.moderation_status := 'suspended';

    NEW.flag_reason := COALESCE(
      NULLIF(BTRIM(NEW.flag_reason), ''),
      'Listing suspended by an administrator'
    );

    NEW.flagged_at := COALESCE(NEW.flagged_at, NOW());
    NEW.auto_hidden_at := COALESCE(NEW.auto_hidden_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
  sync_property_moderation_status_trigger
  ON public.properties;

CREATE TRIGGER sync_property_moderation_status_trigger
BEFORE UPDATE OF listing_status
ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.sync_property_moderation_status();


COMMENT ON FUNCTION public.sync_property_moderation_status()
IS
  'Synchronizes listing approval and suspension actions with the CUEAF public moderation fields.';


COMMIT;


-- ============================================================
-- VERIFICATION
-- This should return no rows after the migration finishes.
-- ============================================================

SELECT
  id,
  listing_status,
  is_flagged,
  moderation_status,
  flag_reason,
  flagged_at,
  auto_hidden_at
FROM public.properties
WHERE
  (
    listing_status = 'approved'
    AND moderation_status = 'suspended'
  )
  OR
  (
    listing_status = 'suspended'
    AND moderation_status <> 'suspended'
  );