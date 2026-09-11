export const GOOGLE_MAPS_LIBRARIES = ['marker'];

// Set your own JavaScript map ID for production; Google's demo ID supports development.
export const GOOGLE_MAPS_MAP_ID =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
