-- Standardise hostel areas and retire landlord-entered walking minutes.
-- Existing listings remain valid and can be assigned an area when next edited.

alter table public.properties
  add column if not exists area text,
  add column if not exists custom_area text;

alter table public.properties
  alter column walk_mins drop not null;

alter table public.properties
  drop constraint if exists properties_area_check;

alter table public.properties
  add constraint properties_area_check check (
    area is null or area in (
      'mungoni',
      'ndagani',
      'lowlands',
      'marine',
      'landmark',
      'slaughterhouse',
      'juverus',
      'university-gates',
      'other'
    )
  );

alter table public.properties
  drop constraint if exists properties_custom_area_check;

alter table public.properties
  add constraint properties_custom_area_check check (
    area is distinct from 'other'
    or nullif(btrim(custom_area), '') is not null
  );

create index if not exists properties_area_idx
  on public.properties (area);

comment on column public.properties.area is
  'Standardised hostel area code used by student search filters.';

comment on column public.properties.custom_area is
  'Landlord-supplied area name when area is other.';

comment on column public.properties.walk_mins is
  'Deprecated legacy estimate. New travel estimates are calculated from listing coordinates.';
