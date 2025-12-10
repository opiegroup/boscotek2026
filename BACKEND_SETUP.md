# Backend Setup Instructions

## Quick Setup (5 minutes)

### 1. Run Database Migration

```bash
cd "/Users/timm.mcvaigh/boscotek configurator"
supabase db push
```

### 2. Create Storage Bucket

Go to Supabase Dashboard → Storage → Create Bucket:
- Name: `bim-exports`
- Public: **No** (Private - use signed URLs)

### 3. Deploy Edge Functions

```bash
supabase functions deploy generate-ifc
supabase functions deploy generate-data-export
supabase functions deploy generate-spec-pack
```

That's it! The system will then use cloud storage instead of client-side generation.

## What Changes After Backend Setup

**Before (Client-Side)**:
- Files generated in browser
- Downloaded immediately
- No IFC files (only CSV/JSON/TXT)
- No lead tracking in database

**After (Backend)**:
- Files generated on server
- Stored in Supabase Storage
- Full IFC 4 BIM files included
- All leads/exports tracked in database
- Admin dashboard shows real data
- Files available via signed URLs

## Current Status

✅ **Working Now**: Client-side export (CSV, JSON, TXT)
⏳ **When Backend Deployed**: Full BIM export with IFC files

The system works great as-is for testing and demos!
