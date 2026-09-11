-- Chuka Rentals university-ready Phase 1.
-- Prices are represented per semester. Existing legacy price columns remain
-- readable temporarily so current records do not disappear during rollout.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS semester_rent NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS landlord_display_name TEXT,
  ADD COLUMN IF NOT EXISTS caretaker_name TEXT,
  ADD COLUMN IF NOT EXISTS caretaker_phone TEXT,
  ADD COLUMN IF NOT EXISTS caretaker_hours TEXT,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  ADD COLUMN IF NOT EXISTS electricity_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (electricity_cost >= 0),
  ADD COLUMN IF NOT EXISTS wifi_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (wifi_cost >= 0),
  ADD COLUMN IF NOT EXISTS other_charges TEXT,
  ADD COLUMN IF NOT EXISTS security_lighting BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cctv_available BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='properties' AND column_name='price') THEN
    EXECUTE 'UPDATE public.properties SET semester_rent = price WHERE semester_rent IS NULL AND price IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='properties' AND column_name='rent') THEN
    EXECUTE 'UPDATE public.properties SET semester_rent = rent WHERE semester_rent IS NULL AND rent IS NOT NULL';
  END IF;
END $$;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_semester_rent_nonnegative CHECK (semester_rent IS NULL OR semester_rent >= 0);

COMMENT ON COLUMN public.properties.semester_rent IS 'Advertised accommodation rent for one academic semester, in KES.';
COMMENT ON COLUMN public.properties.caretaker_phone IS 'Listing contact supplied with caretaker permission; not identity-verification evidence.';
