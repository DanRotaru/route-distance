/**
 * Optional usage analytics: Microsoft Clarity and Google Analytics 4, each loaded only when its ID is set
 * at build time (VITE_CLARITY_ID / VITE_GA_ID in `.env.local`). Without IDs nothing is loaded.
 *
 * - GA gets the page URL without the `#…` part (which holds the route's coordinates and place names).
 * - Clarity masking is turned off: the whole page is marked `data-clarity-unmask`, so recordings show
 *   real text and input values.
 */

const CLARITY_ID = import.meta.env.VITE_CLARITY_ID as string | undefined;
const GA_ID = import.meta.env.VITE_GA_ID as string | undefined;

export const ANALYTICS = { clarity: !!CLARITY_ID, ga: !!GA_ID };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
  }
}

function loadScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

export function initAnalytics() {
  if (GA_ID) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // gtag.js expects the `arguments` object itself, not an array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      page_location: location.origin + location.pathname, // never the hash with the route
      anonymize_ip: true,
    });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`);
  }

  if (CLARITY_ID) {
    // Unmask everything: Clarity honors this on an ancestor for its whole subtree.
    document.documentElement.setAttribute('data-clarity-unmask', 'true');
    // Clarity's stub: queue calls until the real script loads and replays them.
    if (!window.clarity) {
      const stub = (...args: unknown[]) => void (stub.q ??= []).push(args);
      stub.q = undefined as unknown[] | undefined;
      window.clarity = stub;
    }
    loadScript(`https://www.clarity.ms/tag/${encodeURIComponent(CLARITY_ID)}`);
  }
}
