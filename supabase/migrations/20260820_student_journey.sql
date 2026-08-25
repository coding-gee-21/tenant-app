-- Chuka Rentals: saved searches, structured viewing requests, and professional student journey.

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.viewing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_date DATE NOT NULL,
  preferred_period TEXT NOT NULL CHECK (preferred_period IN ('morning', 'afternoon', 'evening')),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'reschedule', 'declined', 'completed', 'cancelled')),
  landlord_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS viewing_requests_active_unique
  ON public.viewing_requests(property_id, student_id)
  WHERE status IN ('pending', 'accepted', 'reschedule');

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students manage own saved searches" ON public.saved_searches;
CREATE POLICY "Students manage own saved searches" ON public.saved_searches
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Students create own viewing requests" ON public.viewing_requests;
CREATE POLICY "Students create own viewing requests" ON public.viewing_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND (p.user_id = landlord_id OR p.landlord_id = landlord_id)
    )
  );

DROP POLICY IF EXISTS "Participants view viewing requests" ON public.viewing_requests;
CREATE POLICY "Participants view viewing requests" ON public.viewing_requests
  FOR SELECT TO authenticated USING (student_id = auth.uid() OR landlord_id = auth.uid());

DROP POLICY IF EXISTS "Participants update viewing requests" ON public.viewing_requests;
CREATE POLICY "Participants update viewing requests" ON public.viewing_requests
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR landlord_id = auth.uid())
  WITH CHECK (student_id = auth.uid() OR landlord_id = auth.uid());

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS last_vacancy_update TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.refresh_vacancy_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.vacant_rooms IS DISTINCT FROM OLD.vacant_rooms THEN NEW.last_vacancy_update = NOW(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_vacancy_timestamp_trigger ON public.properties;
CREATE TRIGGER refresh_vacancy_timestamp_trigger
BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.refresh_vacancy_timestamp();

