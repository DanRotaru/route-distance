import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Public URL of the app (no trailing slash). Also hard-coded in index.html's SEO tags. */
const SITE_URL = 'https://dan13.me/route-distance';

/** Emits sitemap.xml at build time. (robots.txt only counts at the domain root, so it lives on dan13.me.) */
function sitemap(): Plugin {
  const lastmod = new Date().toISOString().slice(0, 10);
  return {
    name: 'route-distance-sitemap',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `  <url>\n    <loc>${SITE_URL}/</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n` +
          '</urlset>\n',
      });
    },
  };
}

export default defineConfig({
  // Relative asset URLs, so the build works under /route-distance/ (or any other folder).
  base: './',
  plugins: [react(), sitemap()],
});
