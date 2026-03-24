# REFUGEE_NODE

Refugee resource finder — Next.js + Supabase + Mapbox + Claude AI

## Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (Postgres + PostGIS)
- **Map**: Mapbox GL JS via react-map-gl
- **Auth**: Clerk
- **AI Search**: Anthropic Claude (claude-sonnet-4-20250514)
- **Translation**: DeepL API
- **Hosting**: Vercel

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy `.env.local` and fill in your API keys:
- **Supabase**: Create project at supabase.com → Settings → API
- **Clerk**: Create app at clerk.com → API Keys
- **Anthropic**: console.anthropic.com → API Keys
- **Mapbox**: account.mapbox.com → Tokens
- **DeepL**: deepl.com/pro → Account → Auth Key

### 3. Set up the database
In Supabase SQL Editor, run `SUPABASE_SCHEMA.sql` in full.
This creates tables, PostGIS functions, indexes, and RLS policies.

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy to Vercel
```bash
npx vercel --prod
```
Add all `.env.local` variables to Vercel Environment Variables.

## Project Structure
```
app/
  layout.tsx          # Root layout with Clerk + fonts
  page.tsx            # Redirect → /map
  map/page.tsx        # Main map view (3-panel layout)
  dashboard/page.tsx  # Admin dashboard
  directory/page.tsx  # Full resource directory
  urgent/page.tsx     # Crisis/urgent resources
  api/
    resources/        # GET (list) / POST (submit new)
    search/           # AI-powered search endpoint
    translate/        # DeepL translation endpoint

components/
  map/                # MapView, StateNode, Tooltip
  ui/                 # Navbar, Sidebar, ResourceCard, StatusBadge
  resources/          # ResourcePanel, FilterBar

lib/
  supabase.ts         # Browser + server + admin clients
  anthropic.ts        # AI search + triage
  deepl.ts            # Translation
  utils.ts            # Helpers

hooks/
  useResources.ts     # SWR data fetching
  useGeolocation.ts   # Browser geolocation
  useSearch.ts        # Search state

types/index.ts        # All TypeScript interfaces
SUPABASE_SCHEMA.sql   # Full DB schema with PostGIS
```

## Key Features
- **AI Search**: Natural language queries ("shelter near downtown Chicago open tonight")
- **Geospatial**: PostGIS radius filtering — find resources within X miles
- **Real-time**: Supabase realtime for live resource status updates
- **Translation**: 7 languages via DeepL (Arabic, Spanish, Farsi, French, Chinese, Ukrainian, Russian)
- **Crisis triage**: Urgent keyword detection routes to emergency resources first
- **Auth**: Clerk for admin/contributor resource management
- **RLS**: Row-level security — public reads verified only, admins manage all
