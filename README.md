<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ocATIGXm3knkMVDB8t0B7DlhMXngfQJL

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project
   - `SUPABASE_SERVICE_ROLE_KEY` (kept local only, used by Supabase functions)
   - `VITE_GEMINI_API_KEY` for AI-powered imports
3. Run the app:
   `npm run dev`

## Supabase Edge Functions

We deploy two functions: `seed-catalog` and `submit-quote`.

1. Ensure secrets are set (Supabase CLI):
   ```
   supabase secrets set PROJECT_URL="https://<your-project>.supabase.co" SERVICE_ROLE_KEY="<service-role-key>"
   ```
2. Deploy:
   ```
   supabase functions deploy seed-catalog
   supabase functions deploy submit-quote
   ```
3. To serve locally (requires Docker + Deno):
   ```
   supabase functions serve seed-catalog --env-file .env.local
   supabase functions serve submit-quote --env-file .env.local
   ```
