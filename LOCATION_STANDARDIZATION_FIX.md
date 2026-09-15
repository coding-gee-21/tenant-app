# Location standardization fix

## Cause of the missing Ndagani listing

Older listings stored their location in `landmark`, while the new filter checked only the canonical `area` column. A listing could therefore display **Ndagani** but fail the `area === 'ndagani'` filter.

## Fix included

- Legacy locations are recognized case-insensitively from `area`, `landmark`, `campus_landmark`, or `custom_area`.
- Ndagani and the other approved locations now match the standardized filter even before database backfilling.
- The new SQL migration permanently backfills canonical area codes for old listings.
- Add Property and Edit Property use the standardized dropdown only.
- Selecting **Other** reveals a required **Exact area/location** field.
- The selected standard location is also written to the legacy `landmark` column for compatibility.

## Installation

1. Extract the package into the root of the `tenant` workspace and replace matching files.
2. Run `supabase/migrations/20260915_backfill_legacy_property_areas.sql` in the Supabase SQL Editor.
3. Restart the development server with `npm.cmd run dev`.

## Test

1. Select **Ndagani** on the home page and confirm the legacy test rental appears.
2. Open **List Property** and confirm there is one standardized hostel-area dropdown.
3. Select **Other** and confirm **Exact area/location** appears and is required.
4. Edit an older Ndagani listing and confirm the dropdown is automatically set to **Ndagani**.
