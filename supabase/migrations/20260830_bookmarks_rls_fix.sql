-- Chuka Rentals: repair saved-property access without weakening RLS.
-- A signed-in user may only create, read, update or remove their own bookmarks.

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookmarks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookmarks', policy_row.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users read their own bookmarks"
ON public.bookmarks
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create their own bookmarks"
ON public.bookmarks
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own bookmarks"
ON public.bookmarks
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own bookmarks"
ON public.bookmarks
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;

COMMENT ON TABLE public.bookmarks IS 'Private saved-property records; each authenticated user can access only rows matching auth.uid().';
