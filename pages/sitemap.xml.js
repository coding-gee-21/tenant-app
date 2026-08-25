import { supabase } from '../lib/supabaseClient';

const BASE_URL = 'https://tenant-app-neon.vercel.app';

function generateSiteMap(properties) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/rentals</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${BASE_URL}/safety</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  ${properties
    .map(({ id, updated_at }) => {
      return `
  <url>
    <loc>${BASE_URL}/properties/${id}</loc>
    <lastmod>${updated_at ? new Date(updated_at).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join('')}
</urlset>`;
}

export default function SiteMap() {
  // getServerSideProps does all the heavy lifting
}

export async function getServerSideProps({ res }) {
  // Fetch all approved property IDs from Supabase
  const { data: properties } = await supabase
    .from('properties')
    .select('id, updated_at')
    .eq('listing_status', 'approved');

  const propertyList = properties || [];

  const sitemap = generateSiteMap(propertyList);

  res.setHeader('Content-Type', 'text/xml');
  res.write(sitemap);
  res.end();

  return {
    props: {},
  };
}
