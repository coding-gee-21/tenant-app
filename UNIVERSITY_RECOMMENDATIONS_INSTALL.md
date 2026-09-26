# University Recommendations Release

This release implements the three recommendations received after the second presentation:

1. A valid student property report automatically removes the listing from public discovery and sends it to the administrator's flagged-listings queue.
2. Landlords can select any combination of Security Guard, Gated Compound, and Biometrics.
3. The distance filter is automatically linked to the selected Gate A walking-time range.

## Required installation order

The database migration must be applied before the updated website is deployed. The student-facing queries use the new `moderation_status`, `is_flagged`, and `security_amenities` columns.

1. Open the Supabase project dashboard.
2. Open **SQL Editor** and create a new query.
3. Copy and run the complete contents of:

   `supabase/migrations/20260924_automatic_quarantine_security_amenities.sql`

4. Copy the updated source files into the local repository.
5. From `C:\Users\Administrator\Documents\tenant`, run:

   ```powershell
   npm.cmd run lint
   npm.cmd run build
   npm.cmd run dev
   ```

6. Test locally, then commit and push the release.

## Behaviour and safeguards

- Reporting requires a signed-in account with a confirmed email address.
- A landlord cannot report their own property.
- The same student cannot repeatedly report the same property within 30 days.
- Direct report-table inserts are blocked. The report and temporary hiding happen atomically through `report_property_and_quarantine`.
- A first valid report changes the property to `under_review`; public listing pages, detail pages, saved listings, comparisons, the map, and the sitemap exclude it.
- The administrator can clear the report, require re-verification, or suspend the listing.
- Clearing a report restores public visibility. Re-verification and suspension keep the listing hidden.
- Existing single-value security records remain readable and are backfilled into the new multi-select field when possible.

## Acceptance tests

### Automatic flagging

1. Sign in as a student with a confirmed email.
2. Open an approved public listing and submit a report containing at least 10 characters.
3. Confirm that the browser returns to `/rentals` and that the listing is absent from the home page, rentals page, map, saved listings, comparisons, direct detail URL, and sitemap.
4. Open the admin dashboard and confirm that the report appears under **Flagged Listings** as temporarily hidden.
5. Choose **Clear Flag** and confirm that the listing returns to public pages.
6. Repeat with **Require Re-verification** and **Suspend Listing** and confirm that both actions keep the listing hidden.

### Security amenities

1. Create a test listing and select all three security options.
2. Confirm that the three values are saved and displayed on the property detail and comparison pages.
3. Edit the listing, remove one option, save, and confirm that the remaining two values persist.
4. Open an older listing and confirm that its legacy single security value still displays.

### Linked time and distance

1. On the home page, rentals page, and map page, select each walking-time range.
2. Confirm that the distance field immediately fills with its corresponding approximate range and cannot be edited independently.
3. Confirm that results are filtered using the calculated walking time from the saved property coordinates.
4. Clear the walking-time selection and confirm that the linked distance field clears too.

## Important deployment note

Do not deploy the JavaScript changes before running the SQL migration. If Vercel is connected to `main`, run the migration first, push the feature branch, verify the preview deployment, and then merge or fast-forward it into `main`.
