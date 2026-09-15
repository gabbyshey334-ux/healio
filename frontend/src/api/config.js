/**
 * Same-origin `/api` in production (Vercel Services).
 * Local Vite proxies `/api` → Express (see vite.config.js).
 * Override with VITE_API_URL when the API is on another host.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? '';
