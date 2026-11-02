/**
 * Returns the canonical base URL for the application across Vercel, production, and localhost.
 */
export function getAppBaseUrl(): string {
  // 1. Explicit environment variable configured by the user/team
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }

  // 2. Browser context: use current window origin
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  // 3. Vercel deployment URL (automatically set on Vercel)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }

  // 4. Localhost fallback
  return 'http://localhost:3000';
}
