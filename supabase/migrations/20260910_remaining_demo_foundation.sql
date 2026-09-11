-- Chuka Rentals: remaining demo foundation.
-- Adds private threaded messages for rent concerns and reviews,
-- secure concern resolution, deadline enforcement, and property GPS fields.
-- Safe to rerun after the existing rent transparency and review migrations.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.properties') IS NULL THEN
    RAISE EXCEPTION 'Required table public.properties does not exist';
  END IF;

  IF to_regclass('public.reviews') IS NULL THEN
    RAISE EXCEPTION 'Required table public.reviews does not exist';
  END IF;

  IF to_regclass('public.rent_notice_concerns') IS NULL THEN
    RAISE EXCEPTION 'Required table public.rent_notice_concerns does not exist';
  END IF;

  IF to_regclass('public.rent_change_notices') IS NULL THEN
    RAISE EXCEPTION 'Required table public.rent_change_notices does not exist';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- GPS destination stored on each property
-- ---------------------------------------------------------------------------

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_accuracy_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_latitude_check,
  DROP CONSTRAINT IF EXISTS properties_longitude_check,
  DROP CONSTRAINT IF EXISTS properties_location_accuracy_check,
  DROP CONSTRAINT IF EXISTS properties_coordinate_pair_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_latitude_check
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT properties_longitude_check
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT properties_location_accuracy_check
    CHECK (
      location_accuracy_meters IS NULL
      OR location_accuracy_meters >= 0
    ),
  ADD CONSTRAINT properties_coordinate_pair_check
    CHECK (
      (latitude IS NULL AND longitude IS NULL)
      OR (latitude IS NOT NULL AND longitude IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS properties_coordinates_idx
  ON public.properties(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Existing property RLS continues to control who may update these columns.
-- Public property readers may see only the hostel destination coordinates;
-- no student location is stored by this migration.

-- ---------------------------------------------------------------------------
-- Rent concern conversation state
-- ---------------------------------------------------------------------------

ALTER TABLE public.rent_notice_concerns
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id);

ALTER TABLE public.rent_notice_concerns
  DROP CONSTRAINT IF EXISTS rent_notice_concerns_status_check;

ALTER TABLE public.rent_notice_concerns
  ADD CONSTRAINT rent_notice_concerns_status_check
    CHECK (
      status IN (
        'submitted',
        'responded',
        'in_discussion',
        'resolved'
      )
    );

UPDATE public.rent_notice_concerns
SET last_message_at = COALESCE(
  last_message_at,
  responded_at,
  submitted_at,
  updated_at
)
WHERE last_message_at IS NULL;

-- ---------------------------------------------------------------------------
-- Threaded message tables
-- sender_id is retained for authorization and auditing. Client applications
-- receive sender_role instead, preventing the new review thread from exposing
-- an anonymous reviewer's account identifier.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rent_concern_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_id UUID NOT NULL
    REFERENCES public.rent_notice_concerns(id)
    ON DELETE CASCADE,
  sender_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,
  sender_role TEXT NOT NULL
    CHECK (sender_role IN ('student', 'landlord')),
  message TEXT NOT NULL
    CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.review_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL
    REFERENCES public.reviews(id)
    ON DELETE CASCADE,
  sender_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,
  sender_role TEXT NOT NULL
    CHECK (sender_role IN ('student', 'landlord')),
  message TEXT NOT NULL
    CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS rent_concern_messages_thread_idx
  ON public.rent_concern_messages(concern_id, created_at, id);

CREATE INDEX IF NOT EXISTS rent_concern_messages_unread_idx
  ON public.rent_concern_messages(concern_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS review_messages_thread_idx
  ON public.review_messages(review_id, created_at, id);

CREATE INDEX IF NOT EXISTS review_messages_unread_idx
  ON public.review_messages(review_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE public.rent_concern_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_messages ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Participant checks. SECURITY DEFINER avoids nested RLS hiding the parent row
-- while exposing only a yes/no authorization result.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_rent_concern(
  target_concern_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rent_notice_concerns AS concern
    JOIN public.rent_change_notices AS notice
      ON notice.id = concern.notice_id
    LEFT JOIN public.properties AS property
      ON property.id = notice.property_id
    WHERE concern.id = target_concern_id
      AND (
        concern.student_id = auth.uid()
        OR notice.landlord_id = auth.uid()
        OR property.user_id = auth.uid()
        OR property.landlord_id = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_review_thread(
  target_review_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reviews AS review
    JOIN public.properties AS property
      ON property.id = review.property_id
    WHERE review.id = target_review_id
      AND (
        review.user_id = auth.uid()
        OR property.user_id = auth.uid()
        OR property.landlord_id = auth.uid()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_rent_concern(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_review_thread(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_rent_concern(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_review_thread(UUID)
  TO authenticated;

DROP POLICY IF EXISTS "Concern participants read messages"
  ON public.rent_concern_messages;
CREATE POLICY "Concern participants read messages"
  ON public.rent_concern_messages
  FOR SELECT
  TO authenticated
  USING (public.can_access_rent_concern(concern_id));

DROP POLICY IF EXISTS "Review participants read private messages"
  ON public.review_messages;
CREATE POLICY "Review participants read private messages"
  ON public.review_messages
  FOR SELECT
  TO authenticated
  USING (public.can_access_review_thread(review_id));

-- Remove direct write privileges. All message writes use the validated RPCs
-- below, so sender identity and sender role cannot be forged by the browser.
REVOKE ALL ON public.rent_concern_messages FROM anon, authenticated;
REVOKE ALL ON public.review_messages FROM anon, authenticated;

GRANT SELECT (
  id,
  concern_id,
  sender_role,
  message,
  created_at,
  read_at
) ON public.rent_concern_messages TO authenticated;

GRANT SELECT (
  id,
  review_id,
  sender_role,
  message,
  created_at,
  read_at
) ON public.review_messages TO authenticated;

-- ---------------------------------------------------------------------------
-- Deadline enforcement for the initial student concern
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_rent_concern_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deadline DATE;
BEGIN
  SELECT notice.response_deadline
  INTO deadline
  FROM public.rent_change_notices AS notice
  WHERE notice.id = NEW.notice_id;

  IF deadline IS NOT NULL AND CURRENT_DATE > deadline THEN
    RAISE EXCEPTION
      'The response deadline for this rent notice has passed'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_rent_concern_deadline_trigger
  ON public.rent_notice_concerns;
CREATE TRIGGER enforce_rent_concern_deadline_trigger
  BEFORE INSERT ON public.rent_notice_concerns
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rent_concern_deadline();

-- ---------------------------------------------------------------------------
-- Message send RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_rent_concern_message(
  target_concern_id UUID,
  message_body TEXT
)
RETURNS TABLE (
  id UUID,
  concern_id UUID,
  sender_role TEXT,
  message TEXT,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role TEXT;
  cleaned_message TEXT := btrim(message_body);
  created_message_id UUID;
  current_status TEXT;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF cleaned_message IS NULL
     OR char_length(cleaned_message) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Message must contain between 1 and 2,000 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    CASE
      WHEN concern.student_id = actor_id THEN 'student'
      WHEN notice.landlord_id = actor_id
        OR property.user_id = actor_id
        OR property.landlord_id = actor_id THEN 'landlord'
      ELSE NULL
    END,
    concern.status
  INTO actor_role, current_status
  FROM public.rent_notice_concerns AS concern
  JOIN public.rent_change_notices AS notice
    ON notice.id = concern.notice_id
  LEFT JOIN public.properties AS property
    ON property.id = notice.property_id
  WHERE concern.id = target_concern_id;

  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'You are not a participant in this concern'
      USING ERRCODE = '42501';
  END IF;

  IF current_status = 'resolved' THEN
    RAISE EXCEPTION 'This concern has been resolved and is read-only'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.rent_concern_messages AS inserted_message (
    concern_id,
    sender_id,
    sender_role,
    message
  )
  VALUES (
    target_concern_id,
    actor_id,
    actor_role,
    cleaned_message
  )
  RETURNING inserted_message.id
  INTO created_message_id;

  UPDATE public.rent_notice_concerns AS concern
  SET
    status = 'in_discussion',
    last_message_at = NOW(),
    updated_at = NOW()
  WHERE concern.id = target_concern_id;

  RETURN QUERY
  SELECT
    thread_message.id,
    thread_message.concern_id,
    thread_message.sender_role,
    thread_message.message,
    thread_message.created_at,
    thread_message.read_at
  FROM public.rent_concern_messages AS thread_message
  WHERE thread_message.id = created_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_review_message(
  target_review_id UUID,
  message_body TEXT
)
RETURNS TABLE (
  id UUID,
  review_id UUID,
  sender_role TEXT,
  message TEXT,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role TEXT;
  cleaned_message TEXT := btrim(message_body);
  created_message_id UUID;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF cleaned_message IS NULL
     OR char_length(cleaned_message) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Message must contain between 1 and 2,000 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    CASE
      WHEN review.user_id = actor_id THEN 'student'
      WHEN property.user_id = actor_id
        OR property.landlord_id = actor_id THEN 'landlord'
      ELSE NULL
    END
  INTO actor_role
  FROM public.reviews AS review
  JOIN public.properties AS property
    ON property.id = review.property_id
  WHERE review.id = target_review_id;

  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'You are not a participant in this review discussion'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.review_messages AS inserted_message (
    review_id,
    sender_id,
    sender_role,
    message
  )
  VALUES (
    target_review_id,
    actor_id,
    actor_role,
    cleaned_message
  )
  RETURNING inserted_message.id
  INTO created_message_id;

  RETURN QUERY
  SELECT
    thread_message.id,
    thread_message.review_id,
    thread_message.sender_role,
    thread_message.message,
    thread_message.created_at,
    thread_message.read_at
  FROM public.review_messages AS thread_message
  WHERE thread_message.id = created_message_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Read-state RPCs. A sender cannot mark their own message as received.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_rent_concern_messages_read(
  target_concern_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id UUID := auth.uid();
  affected_rows INTEGER;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_access_rent_concern(target_concern_id) THEN
    RAISE EXCEPTION 'You are not a participant in this concern'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.rent_concern_messages
  SET read_at = NOW()
  WHERE concern_id = target_concern_id
    AND sender_id <> actor_id
    AND read_at IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_review_messages_read(
  target_review_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id UUID := auth.uid();
  affected_rows INTEGER;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_access_review_thread(target_review_id) THEN
    RAISE EXCEPTION 'You are not a participant in this review discussion'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.review_messages
  SET read_at = NOW()
  WHERE review_id = target_review_id
    AND sender_id <> actor_id
    AND read_at IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

-- Only the student who opened a concern confirms resolution or reopens it.
CREATE OR REPLACE FUNCTION public.set_rent_concern_resolved(
  target_concern_id UUID,
  resolved BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id UUID := auth.uid();
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.rent_notice_concerns AS concern
    WHERE concern.id = target_concern_id
      AND concern.student_id = actor_id
  ) THEN
    RAISE EXCEPTION 'Only the student who raised this concern may change its resolution'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.rent_notice_concerns
  SET
    status = CASE
      WHEN resolved THEN 'resolved'
      ELSE 'in_discussion'
    END,
    resolved_at = CASE
      WHEN resolved THEN NOW()
      ELSE NULL
    END,
    resolved_by = CASE
      WHEN resolved THEN actor_id
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = target_concern_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_rent_concern_message(UUID, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_review_message(UUID, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_rent_concern_messages_read(UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_review_messages_read(UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_rent_concern_resolved(UUID, BOOLEAN)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.send_rent_concern_message(UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_review_message(UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_rent_concern_messages_read(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_review_messages_read(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_rent_concern_resolved(UUID, BOOLEAN)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Realtime support, when the standard Supabase publication exists.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'rent_concern_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.rent_concern_messages;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'review_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.review_messages;
  END IF;
END;
$$;

COMMIT;

-- Read-only verification queries to run after the migration:
--
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('rent_concern_messages', 'review_messages');
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'properties'
--   AND column_name IN (
--     'latitude',
--     'longitude',
--     'location_accuracy_meters',
--     'location_updated_at'
--   )
-- ORDER BY ordinal_position;
--
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('rent_concern_messages', 'review_messages')
-- ORDER BY tablename, policyname;
--
-- SELECT routine_name
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'send_rent_concern_message',
--     'send_review_message',
--     'mark_rent_concern_messages_read',
--     'mark_review_messages_read',
--     'set_rent_concern_resolved'
--   )
-- ORDER BY routine_name;
