-- Chuka Rentals: semester rent transparency system.
-- All rental amounts represent one academic semester.

CREATE TABLE IF NOT EXISTS public.rent_change_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  property_id UUID NOT NULL
    REFERENCES public.properties(id)
    ON DELETE CASCADE,

  landlord_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  previous_semester_rent NUMERIC(12, 2) NOT NULL
    CHECK (previous_semester_rent >= 0),

  proposed_semester_rent NUMERIC(12, 2) NOT NULL
    CHECK (proposed_semester_rent >= 0),

  effective_semester TEXT NOT NULL,

  reason TEXT NOT NULL
    CHECK (char_length(trim(reason)) >= 10),

  supporting_document_url TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'published',
        'cancelled',
        'under_review'
      )
    ),

  notice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    proposed_semester_rent <> previous_semester_rent
  )
);

CREATE INDEX IF NOT EXISTS rent_change_notices_property_idx
ON public.rent_change_notices(property_id);

CREATE INDEX IF NOT EXISTS rent_change_notices_landlord_idx
ON public.rent_change_notices(landlord_id);

CREATE INDEX IF NOT EXISTS rent_change_notices_status_idx
ON public.rent_change_notices(status);


-- Student acknowledgements

CREATE TABLE IF NOT EXISTS public.rent_notice_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  notice_id UUID NOT NULL
    REFERENCES public.rent_change_notices(id)
    ON DELETE CASCADE,

  student_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (notice_id, student_id)
);


-- Enable Row Level Security

ALTER TABLE public.rent_change_notices
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rent_notice_acknowledgements
ENABLE ROW LEVEL SECURITY;


-- Remove older policy versions when rerunning this script

DROP POLICY IF EXISTS
  "Published notices are publicly readable"
ON public.rent_change_notices;

DROP POLICY IF EXISTS
  "Landlords read their own notices"
ON public.rent_change_notices;

DROP POLICY IF EXISTS
  "Landlords create notices for owned properties"
ON public.rent_change_notices;

DROP POLICY IF EXISTS
  "Landlords update their own notices"
ON public.rent_change_notices;

DROP POLICY IF EXISTS
  "Landlords delete their own draft notices"
ON public.rent_change_notices;

DROP POLICY IF EXISTS
  "Students read their acknowledgements"
ON public.rent_notice_acknowledgements;

DROP POLICY IF EXISTS
  "Students acknowledge published notices"
ON public.rent_notice_acknowledgements;

DROP POLICY IF EXISTS
  "Students remove their acknowledgements"
ON public.rent_notice_acknowledgements;


-- Published notices are publicly readable

CREATE POLICY "Published notices are publicly readable"
ON public.rent_change_notices
FOR SELECT
TO anon, authenticated
USING (
  status = 'published'
);


-- Landlords can read notices they created

CREATE POLICY "Landlords read their own notices"
ON public.rent_change_notices
FOR SELECT
TO authenticated
USING (
  landlord_id = auth.uid()
);


-- Landlords can create notices only for their own properties

CREATE POLICY "Landlords create notices for owned properties"
ON public.rent_change_notices
FOR INSERT
TO authenticated
WITH CHECK (
  landlord_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.properties AS owned_property
    WHERE owned_property.id =
      rent_change_notices.property_id
      AND (
        owned_property.landlord_id = auth.uid()
        OR owned_property.user_id = auth.uid()
      )
  )
);


-- Landlords can update notices belonging to them

CREATE POLICY "Landlords update their own notices"
ON public.rent_change_notices
FOR UPDATE
TO authenticated
USING (
  landlord_id = auth.uid()
  AND status IN (
    'draft',
    'published',
    'under_review'
  )
)
WITH CHECK (
  landlord_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.properties AS owned_property
    WHERE owned_property.id =
      rent_change_notices.property_id
      AND (
        owned_property.landlord_id = auth.uid()
        OR owned_property.user_id = auth.uid()
      )
  )
);


-- Landlords can delete only their draft notices

CREATE POLICY "Landlords delete their own draft notices"
ON public.rent_change_notices
FOR DELETE
TO authenticated
USING (
  landlord_id = auth.uid()
  AND status = 'draft'
);


-- Students can read their own acknowledgements

CREATE POLICY "Students read their acknowledgements"
ON public.rent_notice_acknowledgements
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
);


-- Students can acknowledge only published notices

CREATE POLICY "Students acknowledge published notices"
ON public.rent_notice_acknowledgements
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.rent_change_notices AS notice
    WHERE notice.id =
      rent_notice_acknowledgements.notice_id
      AND notice.status = 'published'
  )
);


-- Students can remove only their own acknowledgements

CREATE POLICY "Students remove their acknowledgements"
ON public.rent_notice_acknowledgements
FOR DELETE
TO authenticated
USING (
  student_id = auth.uid()
);


-- Table permissions

GRANT SELECT
ON public.rent_change_notices
TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE
ON public.rent_change_notices
TO authenticated;

GRANT SELECT, INSERT, DELETE
ON public.rent_notice_acknowledgements
TO authenticated;