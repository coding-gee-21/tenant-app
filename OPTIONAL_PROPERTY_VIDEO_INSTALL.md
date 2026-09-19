# Optional Property Video Installation

This update adds one optional walkthrough video to each property listing.
Existing listings remain unchanged because the new `video_url` field accepts
`NULL`.

## Included files

- `lib/propertyVideo.js`
- `pages/add-property.js`
- `components/EditPropertyModal.jsx`
- `pages/properties/[id].js`
- `supabase/migrations/20260919_optional_property_video.sql`

## Installation order

1. Copy the included files into the matching project folders.
2. Open the Supabase SQL Editor.
3. Run `supabase/migrations/20260919_optional_property_video.sql` once.
4. Restart the local Next.js development server.
5. Test a new listing without a video and confirm that it publishes normally.
6. Test another listing with one MP4 or WebM video no larger than 50 MB.
7. Approve the test listing and confirm that the video appears on its property
   details page.
8. Open the landlord dashboard, edit the listing, and test replacement and
   removal of the video.

## Production release

Apply the same SQL migration to the production Supabase project before
deploying the new frontend code. No new Vercel environment variable is needed.
The migration creates the public `property-videos` bucket and limits uploads
to the authenticated user's own storage folder.

Video storage and delivery consume Supabase Storage capacity and bandwidth, so
usage should be monitored after launch.
