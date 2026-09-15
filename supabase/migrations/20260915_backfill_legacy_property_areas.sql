-- Assign canonical area codes to listings created before the standardised
-- hostel-area dropdown was introduced.

with legacy_locations as (
  select
    id,
    btrim(coalesce(landmark, '')) as original_location,
    lower(btrim(coalesce(landmark, ''))) as normalized_location
  from public.properties
  where area is null
    and nullif(btrim(coalesce(landmark, '')), '') is not null
), mapped_locations as (
  select
    id,
    original_location,
    case
      when normalized_location like '%mungoni%' then 'mungoni'
      when normalized_location like '%ndagani%' then 'ndagani'
      when normalized_location like '%lowlands%'
        or normalized_location like '%low lands%' then 'lowlands'
      when normalized_location like '%marine%' then 'marine'
      when normalized_location like '%slaughterhouse%'
        or normalized_location like '%slaughter house%' then 'slaughterhouse'
      when normalized_location like '%juverus%' then 'juverus'
      when normalized_location like '%chuka university%'
        or normalized_location like '%university gate%'
        or normalized_location like '%campus gate%'
        or normalized_location ~ '(^| )gate [abc]($| )' then 'university-gates'
      when normalized_location = 'landmark'
        or normalized_location like 'landmark %' then 'landmark'
      else 'other'
    end as mapped_area
  from legacy_locations
)
update public.properties as property
set
  area = mapped.mapped_area,
  custom_area = case
    when mapped.mapped_area = 'other' then mapped.original_location
    else null
  end
from mapped_locations as mapped
where property.id = mapped.id
  and property.area is null;
