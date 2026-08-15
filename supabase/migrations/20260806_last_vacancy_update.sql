ALTER TABLE public.properties
ADD COLUMN last_vacancy_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();