-- Chuka Rentals: separate student, landlord and administrator experiences.
-- Run this migration after the existing phone-verification migrations.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS landlord_status TEXT,
  ADD COLUMN IF NOT EXISTS student_verified BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles SET role = 'student' WHERE role IS NULL;
UPDATE public.profiles SET landlord_status = 'not_applied' WHERE landlord_status IS NULL;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'student';
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN landlord_status SET DEFAULT 'not_applied';
ALTER TABLE public.profiles ALTER COLUMN landlord_status SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'landlord', 'admin'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_landlord_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_landlord_status_check
  CHECK (landlord_status IN ('not_applied', 'pending', 'approved', 'rejected', 'suspended'));

-- Existing property owners retain access when this migration is introduced.
UPDATE public.profiles p
SET role = 'landlord', landlord_status = 'approved'
WHERE p.role <> 'admin'
  AND EXISTS (SELECT 1 FROM public.properties x WHERE x.user_id = p.id OR x.landlord_id = p.id);

CREATE OR REPLACE FUNCTION public.become_landlord()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND phone_verified = true
  ) THEN RAISE EXCEPTION 'Verify your phone number before opening the landlord portal'; END IF;

  UPDATE public.profiles
  SET role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'landlord' END,
      landlord_status = 'approved'
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.become_landlord() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.become_landlord() TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_account_roles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role')
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.landlord_status IS DISTINCT FROM OLD.landlord_status) THEN
    RAISE EXCEPTION 'Account roles can only be changed through an approved server workflow';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_account_roles_trigger ON public.profiles;
CREATE TRIGGER protect_account_roles_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_account_roles();

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Keep one current review from each account for each property.
DELETE FROM public.reviews older
USING public.reviews newer
WHERE older.user_id = newer.user_id
  AND older.property_id = newer.property_id
  AND (older.created_at, older.id) < (newer.created_at, newer.id);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_user_property
  ON public.reviews(user_id, property_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own safe profile fields" ON public.profiles;
CREATE POLICY "Users can update own safe profile fields" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Restrictive ownership policies remain effective even if an older permissive
-- property policy exists in the project.
DROP POLICY IF EXISTS "Only landlords insert owned properties" ON public.properties;
CREATE POLICY "Only landlords insert owned properties" ON public.properties
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() OR landlord_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('landlord', 'admin'))
  );

DROP POLICY IF EXISTS "Only landlords update owned properties" ON public.properties;
CREATE POLICY "Only landlords update owned properties" ON public.properties
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() OR landlord_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('landlord', 'admin'))
  )
  WITH CHECK (
    (user_id = auth.uid() OR landlord_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('landlord', 'admin'))
  );

DROP POLICY IF EXISTS "Only landlords delete owned properties" ON public.properties;
CREATE POLICY "Only landlords delete owned properties" ON public.properties
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() OR landlord_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('landlord', 'admin'))
  );

DROP POLICY IF EXISTS "Users can read approved reviews" ON public.reviews;
CREATE POLICY "Users can read approved reviews" ON public.reviews
  FOR SELECT USING (status = 'approved' OR user_id = auth.uid());

DROP POLICY IF EXISTS "Verified users can create own reviews" ON public.reviews;
CREATE POLICY "Verified users can create own reviews" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.phone_verified = true)
  );

DROP POLICY IF EXISTS "Users can edit own reviews" ON public.reviews;
CREATE POLICY "Users can edit own reviews" ON public.reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own reviews" ON public.reviews;
CREATE POLICY "Users can delete own reviews" ON public.reviews
  FOR DELETE TO authenticated USING (user_id = auth.uid());
