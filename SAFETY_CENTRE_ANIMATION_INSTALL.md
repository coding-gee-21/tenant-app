# CUEAF Safety Centre Animation Update

This update redesigns and animates the `/safety` page without changing any
database tables or environment variables.

## Files included

- `pages/safety.js`
- `styles/globals.css`

## Installation

1. Copy both files into the matching folders in the current CUEAF project.
2. Restart the local development server with `npm.cmd run dev`.
3. Open `http://localhost:3000/safety`.
4. Check desktop and mobile widths.
5. Run `npm.cmd run lint` and `npm.cmd run build` before committing.

## Motion behaviour

- The header fades and rises into position once.
- The four practical checks enter in a short staggered sequence.
- Desktop hover gently lifts a card and emphasizes its icon and accent line.
- The final warning uses a slow amber highlight sweep rather than flashing.
- `prefers-reduced-motion` disables all entrance and continuous animations.
