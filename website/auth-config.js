/**
 * Supabase client (browser) — anon key is safe to expose; app data is protected with RLS.
 * 1) Dashboard → Project Settings → API → copy "Project URL" and "anon public" key into this file.
 * 2) Apply DB migration (creates user_app_data + RLS): from repo root run
 *    npx supabase db push
 *    (needs supabase login / SUPABASE_ACCESS_TOKEN)
 * 3) Authentication → URL Configuration → Site URL + Redirect URLs, e.g.:
 *    https://YOUR-PROJECT.vercel.app/login.html
 *    http://localhost:8000/login.html
 * 4) Authentication → Providers → Email: enable and allow password sign-in (and magic link if you want).
 *    Custom SMTP improves delivery for magic link / password reset emails.
 *
 * Optional API backend (food search, chat, camera scan):
 * If the site is opened as static files (e.g. GitHub Pages) or POST returns "405 Method Not Allowed",
 * set this to your deployed backend origin (no trailing slash), e.g.:
 *   window.NUTRIPLANNER_API_ORIGIN = "https://your-app.vercel.app";
 * Leave unset to use the same origin as the page (typical for full Vercel deploys).
 */
window.NUTRIPLANNER_SUPABASE_URL = "https://rchmysatxvkfxtvqjvnl.supabase.co";
window.NUTRIPLANNER_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjaG15c2F0eHZrZnh0dnFqdm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NzgzNjcsImV4cCI6MjA5MTI1NDM2N30.JULa-Bx0L0D2FTx1CdV757l-JrGRGbFoKgy4mWbv5ds";
