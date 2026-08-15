-- Table for property reports
CREATE TABLE public.property_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for reminder logs
CREATE TABLE public.property_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    reminder_type VARCHAR(20) DEFAULT 'vacancy_update',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_reminders ENABLE ROW LEVEL SECURITY;

-- Policies: anyone can insert a report; only landlord can view reports for their properties
CREATE POLICY "Anyone can report" ON public.property_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Landlords view own property reports" ON public.property_reports FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = property_reports.property_id
    AND properties.landlord_id = auth.uid()
));

-- Reminders: only system can insert, landlords can view
CREATE POLICY "System insert reminders" ON public.property_reminders FOR INSERT WITH CHECK (true);
CREATE POLICY "Landlords view own property reminders" ON public.property_reminders FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = property_reminders.property_id
    AND properties.landlord_id = auth.uid()
));