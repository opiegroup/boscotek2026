# Troubleshooting 401 Errors

## Problem
Getting 401 authentication errors when trying to download IFC BIM files or capture leads.

## Root Cause
The frontend is unable to authenticate with Supabase, likely due to missing or incorrect environment variables.

## Solution Steps

### Step 1: Verify Environment Variables

1. Make sure you have a `.env` file in the project root (not `env.example`)
2. Open your `.env` file and verify it has these values:

```bash
VITE_SUPABASE_URL=https://svzfendhhixkddejwzxh.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

3. Get your **Anon Key** from Supabase Dashboard:
   - Go to: https://supabase.com/dashboard/project/svzfendhhixkddejwzxh/settings/api
   - Copy the **anon public** key (NOT the service_role key!)
   - It should start with `eyJ...` and be very long (~300+ characters)

### Step 2: Verify Database Migrations

Run this command to ensure all migrations are applied:

```bash
supabase migration list
```

You should see:
```
Local    | Remote   | Time (UTC)
---------|----------|------------
20250101 | 20250101 | 20250101
20250111 | 20250111 | 20250111
20250112 | 20250112 | 20250112
```

If 20250112 is missing, run:
```bash
supabase db push
```

### Step 3: Test Database Connection

After setting up your `.env` file, restart your dev server:

```bash
# Stop the current dev server (Ctrl+C)
npm run dev
```

Open the browser console (F12) and look for:
```
🔧 Supabase Client Initialization:
  URL: ✅ Set
  Anon Key: ✅ Set (eyJ...)
✅ Supabase connected successfully
```

If you see errors, the console will show detailed information about what's wrong.

### Step 4: Verify RLS Policies

The following RLS policies should be enabled (they were created in migration 20250111):

```sql
-- These allow anonymous users to insert data
CREATE POLICY "Anyone can create leads" ON bim_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create configurations" ON configurations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create exports" ON bim_exports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create analytics" ON export_analytics FOR INSERT WITH CHECK (true);
```

To verify, go to:
https://supabase.com/dashboard/project/svzfendhhixkddejwzxh/auth/policies

You should see policies for each table.

### Step 5: Verify Storage Bucket

Go to:
https://supabase.com/dashboard/project/svzfendhhixkddejwzxh/storage/buckets

You should see a bucket named `bim-exports`. If not, the migration didn't apply correctly.

## Common Issues

### Issue: "VITE_SUPABASE_ANON_KEY is undefined"
**Solution:** You forgot to create a `.env` file or named it incorrectly. Make sure:
- File is named `.env` (not `.env.local` or `env.txt`)
- File is in the project root directory
- You restarted the dev server after creating it

### Issue: "Invalid API key" or "JWT expired"
**Solution:** You copied the wrong key. Make sure you're using:
- The **anon public** key (not service_role)
- The key for the correct project (svzfendhhixkddejwzxh)
- The full key (don't truncate it)

### Issue: "Row Level Security policy violation"
**Solution:** The RLS policies weren't applied. Run:
```bash
supabase db push
```

### Issue: Storage bucket errors
**Solution:** The storage bucket wasn't created. The migration (20250112) should have created it automatically.

## Quick Fix Checklist

- [ ] `.env` file exists in project root
- [ ] `VITE_SUPABASE_URL` is set correctly
- [ ] `VITE_SUPABASE_ANON_KEY` is set with the full anon public key
- [ ] Dev server has been restarted after updating `.env`
- [ ] All migrations show as applied (`supabase migration list`)
- [ ] Browser console shows "✅ Supabase connected successfully"
- [ ] Storage bucket `bim-exports` exists in Supabase dashboard

## Still Having Issues?

If you're still getting 401 errors after following all steps:

1. Check the browser console for detailed error messages
2. Copy the error output (with the new detailed logging)
3. Verify your Supabase project is active (not paused)
4. Check if you have any API rate limits or restrictions enabled

## Testing the Fix

After completing all steps:

1. Open the configurator in your browser
2. Configure a product (e.g., HD Cabinet with drawers)
3. Click "Download BIM (IFC)"
4. Fill in the lead capture form
5. Submit

You should see:
- No 401 errors in the console
- "Export generated successfully!" message
- IFC file download starts automatically

If it works, you'll be able to:
- Open the IFC file in BlenderBIM, Revit, or ArchiCAD
- See the full 3D geometry with proper units (meters)
- View all product metadata in the property sets
