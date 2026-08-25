-- Chuka Rentals: email-confirmed student reviews and landlord-only phone OTP.
-- Safe to run after 20260820_account_roles_and_reviews.sql.

-- Landlord onboarding needs an explicit state before the SMS API will send.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_landlord_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_landlord_status_check
  CHECK (
    landlord_status IN (
      'not_applied',
      'phone_pending',
      'pending',
      'approved',
      'rejected',
      'suspended'
    )
  );

-- Create profiles after signup even when Confirm Email means there is no
-- authenticated browser session yet.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, landlord_status)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(NEW.email, '@', 1)),
    'student',
    'not_applied'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_profile_after_auth_signup ON auth.users;
CREATE TRIGGER create_profile_after_auth_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- RLS can call this function without exposing auth.users to the browser.
CREATE OR REPLACE FUNCTION public.current_user_email_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.email_confirmed_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_email_verified() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_email_verified() TO authenticated;

-- A landlord must have both a confirmed email and a verified phone. Keeping
-- this check in the database prevents a modified browser from skipping OTP.
CREATE OR REPLACE FUNCTION public.become_landlord()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_user_email_verified() THEN
    RAISE EXCEPTION 'Verify your email before opening the landlord portal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND phone_verified = true
  ) THEN
    RAISE EXCEPTION 'Verify your phone number before opening the landlord portal';
  END IF;

  UPDATE public.profiles
  SET role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'landlord' END,
      landlord_status = 'approved'
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.become_landlord() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.become_landlord() TO authenticated;

-- Replace phone-based review creation with confirmed-email enforcement.
DROP POLICY IF EXISTS "Verified users can create own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Email verified users can create own reviews" ON public.reviews;
CREATE POLICY "Email verified users can create own reviews" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_email_verified()
  );

-- This restrictive guard continues to protect review inserts even if an older
-- permissive policy still exists in a previously configured project.
DROP POLICY IF EXISTS "Email confirmation required for review inserts" ON public.reviews;
CREATE POLICY "Email confirmation required for review inserts" ON public.reviews
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_email_verified()
  );

DROP POLICY IF EXISTS "Email confirmation required for review updates" ON public.reviews;
CREATE POLICY "Email confirmation required for review updates" ON public.reviews
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.current_user_email_verified())
  WITH CHECK (user_id = auth.uid() AND public.current_user_email_verified());

-- A landlord role is not enough by itself: listing writes also require the
-- verified contact number used by the landlord workflow.
DROP POLICY IF EXISTS "Only landlords insert owned properties" ON public.properties;
CREATE POLICY "Only landlords insert owned properties" ON public.properties
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() OR landlord_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('landlord', 'admin')
        AND (p.role = 'admin' OR p.phone_verified = true)
    )
  );

DROP POLICY IF EXISTS "Only landlords update owned properties" ON public.properties;
CREATE POLICY "Only landlords update owned properties" ON public.properties
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() OR landlord_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('landlord', 'admin')
        AND (p.role = 'admin' OR p.phone_verified = true)
    )
  )
  WITH CHECK (
    (user_id = auth.uid() OR landlord_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('landlord', 'admin')
        AND (p.role = 'admin' OR p.phone_verified = true)
    )
  );

-- Users may edit ordinary profile fields but may never grant themselves a
-- role or a verification badge.
CREATE OR REPLACE FUNCTION public.protect_account_roles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role')
     AND (
       NEW.role IS DISTINCT FROM OLD.role
       OR NEW.landlord_status IS DISTINCT FROM OLD.landlord_status
       OR NEW.phone_number IS DISTINCT FROM OLD.phone_number
       OR NEW.phone_verified IS DISTINCT FROM OLD.phone_verified
       OR NEW.phone_verified_at IS DISTINCT FROM OLD.phone_verified_at
       OR NEW.student_verified IS DISTINCT FROM OLD.student_verified
     ) THEN
    RAISE EXCEPTION 'Protected account fields can only be changed through an approved server workflow';
  END IF;

  RETURN NEW;
END;
$$;
