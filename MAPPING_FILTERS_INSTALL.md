# CUEAF mapping-driven filters

## What changed

- Landlords select a standard hostel area and nearby landmark.
- The manual `Walk (Mins)` field has been removed from both listing forms.
- The map pin automatically produces the displayed distance and walking-time estimate from Chuka University Gate A.
- Home, rentals and map pages now share the same area, walking-time and distance filters.
- Property cards, details and comparisons no longer display landlord-entered walking estimates.

## Install in the Documents tenant project

1. Extract this package into `C:\Users\Administrator\Documents\tenant` and allow Windows to replace matching files.
2. In the Supabase SQL Editor, run:
   `supabase/migrations/20260915_hostel_area_and_automatic_travel.sql`
3. Confirm `.env.local` contains your existing Maps configuration plus the Gate A reference:

   ```env
   NEXT_PUBLIC_CHUKA_UNIVERSITY_LAT=-0.319788
   NEXT_PUBLIC_CHUKA_UNIVERSITY_LNG=37.660109
   ```

4. Restart local development:

   ```powershell
   npm.cmd run dev
   ```

## Verification checklist

1. Open **List Property** as a landlord.
2. Confirm there is no manual walking-minutes input.
3. Select each standard hostel area and confirm **Other** reveals a required custom-area input.
4. Choose a map location and confirm an automatic distance and walking-time estimate appears.
5. Save the listing and confirm the area is stored.
6. Edit the listing, change its area and map pin, then save it again.
7. Approve the listing if needed.
8. Test area, walking-time and distance bands on `/`, `/rentals` and `/map`.
9. Confirm a listing appears only inside the correct non-overlapping range.

Existing listings without an area remain visible when **All hostel areas** is selected. Edit those listings once to assign their correct area.

The displayed values are approximate estimates calculated consistently from the saved coordinates. The **Directions** link remains the source for a live Google Maps walking route.
