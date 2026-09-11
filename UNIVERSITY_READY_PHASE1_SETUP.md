# University-ready Phase 1 setup

This release keeps all accommodation pricing on a **per-semester** basis and adds:

- landlord display and trusted-caretaker details;
- a transparent semester fee breakdown;
- security-lighting and CCTV declarations;
- an expanded management section on property pages;
- a professional, photo-supported tenant-absentee and check-in/check-out inventory at `/landlord/inventory`.

## Supabase

Run `supabase/migrations/20260827_university_ready_phase1.sql` in the Supabase SQL Editor after the earlier migrations.

Then run `supabase/migrations/20260830_bookmarks_rls_fix.sql`. This replaces incorrect bookmark policies with owner-only SELECT, INSERT, UPDATE and DELETE policies, fixing the `new row violates row-level security policy` error without making bookmarks public.

The migration preserves old `price` or `rent` values by copying them into `semester_rent` only when the new field is empty. It does not delete legacy columns.

## Test

1. Sign in through the landlord portal with a verified phone.
2. Add a property and complete Property Management and Semester Cost Breakdown.
3. Approve the listing in the administrator dashboard.
4. Open its public details and verify the semester rent, fee breakdown, management and security sections.
5. Open Landlord Dashboard → Inventory, choose the record type and complete the property, tenant, absence and custody details.
6. Add distinguishing details, exact condition, storage location and an optional local photo for every belonging.
7. Use Print signed copies and confirm the preview uses A4 portrait, includes referenced photographs and hides controls.
8. Sign in as a student, open `/rentals`, select the heart on a property, refresh the page and confirm it appears under Account → Saved rentals.

Caretaker details must only be entered with the caretaker's permission. Identity documents or private verification photographs must stay in a separate private verification workflow.
