# REFUGEE_NODE — Claude Code Briefing

## What this is
A humanitarian resource finder for refugees and asylum seekers in the United States.
Helps users find shelter, food, legal aid, medical care, and language services nearby.
Built with a Vercel-inspired dark terminal aesthetic (IBM Plex Mono, black/white/blue palette).

## Tech stack
- **Framework**: Next.js 14 (App Router, TypeScript)
- **Database**: Supabase (Postgres + PostGIS for geospatial queries)
- **Map**: Mapbox GL JS via react-map-gl (dark-v11 tile style)
- **Auth**: Clerk (admin/contributor roles, public read)
- **AI Search**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Translation**: DeepL API (AR, ES, FA, FR, ZH, UK, RU)
- **Styling**: Tailwind CSS + IBM Plex Mono/Sans fonts
- **Hosting**: Vercel

## Project structure
```
app/
  page.tsx              → redirects to /map
  layout.tsx            → ClerkProvider + IBM Plex fonts
  globals.css           → Tailwind + Mapbox overrides
  map/page.tsx          → MAIN VIEW: 3-panel layout (sidebar/map/resources)
  dashboard/page.tsx    → Admin stats dashboard
  directory/page.tsx    → Full browseable resource grid
  urgent/page.tsx       → Crisis/emergency resources only
  api/
    resources/route.ts  → GET (list) / POST (submit new resource)
    search/route.ts     → AI-powered natural language search
    translate/route.ts  → DeepL translation endpoint

components/
  map/MapView.tsx       → Mapbox GL JS map, markers, popups, fly-to
  ui/Navbar.tsx         → Top nav with language picker + Clerk auth
  ui/Sidebar.tsx        → Category filter panel (Shelter/Food/Legal/Medical/Language)
  ui/ResourceCard.tsx   → Resource card with status badge + directions CTA
  ui/StatusBadge.tsx    → Open/Closed/Closing Soon/Appointment Only badge
  ui/SearchInput.tsx    → Search input with AI indicator
  resources/ResourcePanel.tsx → Right panel: search + AI summary + resource list

lib/
  supabase.ts           → Browser + server + admin Supabase clients
  anthropic.ts          → AI search + urgency triage
  deepl.ts              → Translation + SUPPORTED_LANGUAGES list
  mapbox.ts             → Viewport defaults + marker builder
  utils.ts              → cn(), CATEGORY_CONFIG, STATUS_CONFIG, formatPhone

hooks/
  useResources.ts       → SWR data fetching by state/category
  useGeolocation.ts     → Browser geolocation hook
  useSearch.ts          → AI search state management

types/index.ts          → All TypeScript interfaces (Resource, SearchParams, etc.)
SUPABASE_SCHEMA.sql     → Full DB schema — run this first in Supabase SQL editor
```

## Design system
- **Background**: `#0a0a0a` (primary), `#111111` (cards), `#1a1a1a` (hover)
- **Borders**: `rgba(255,255,255,0.08)` default, `rgba(255,255,255,0.15)` active
- **Accent**: `#2563eb` (blue) — buttons, active states, AI indicators
- **Text**: `#ffffff` primary, `#888888` secondary, `#444444` tertiary
- **Font**: IBM Plex Mono for all labels/UI, IBM Plex Sans for body/names
- **Category colors**: Shelter #3b82f6, Food #22c55e, Legal #a855f7, Medical #ef4444, Language #f59e0b
- **Status colors**: Open #22c55e, Closed #ef4444, Closing Soon #f59e0b, Appointment #888888
- Urgent resources get a red left border: `border-l-[3px] border-l-red-500`
- All labels in CAPS with `tracking-[0.08em]` or higher

## Key data types
```typescript
type ResourceCategory = "shelter" | "food" | "legal" | "medical" | "language";
type ResourceStatus = "open" | "closed" | "closing_soon" | "appointment_only";

interface Resource {
  id, name, category, status, address, city, state, zip,
  lat, lng, phone?, website?, hours?, languages?,
  urgent, verified, created_at, updated_at
}
```

## Environment variables needed
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
ANTHROPIC_API_KEY
NEXT_PUBLIC_MAPBOX_TOKEN
DEEPL_API_KEY
```

## Database setup (do this first)
1. Create project at supabase.com
2. Run `SUPABASE_SCHEMA.sql` in full in the Supabase SQL editor
3. This creates: resources table, PostGIS extension, radius function,
   full-text search index, user_profiles table, and RLS policies

## Dev commands
```bash
npm install          # install dependencies
npm run dev          # start dev server at localhost:3000
npm run build        # production build
npm run lint         # ESLint check
npm run db:types     # regenerate Supabase TypeScript types
```

## Current state
- All components and pages are scaffolded and implemented
- Map uses real Mapbox GL JS with dark tiles, animated markers, popups, fly-to
- AI search wired through /api/search → Anthropic API
- Auth via Clerk (public read, authenticated submit, admin full access)
- Translation via DeepL (7 languages)
- PostGIS radius search implemented in /api/search
- Database schema complete with RLS policies

## What still needs doing
- [ ] Seed Supabase with real US refugee resource data
- [ ] "Report Missing Resource" modal (button exists, handler is placeholder)
- [ ] PWA manifest + service worker for offline support
- [ ] Mobile responsive layout (currently desktop-first)
- [ ] Admin verification flow for submitted resources
- [ ] Real hours parsing (currently stored as JSONB, needs open_now filtering)
- [ ] User saved resources (schema ready, UI not built)
- [ ] FilterBar component (scaffolded but empty)
- [ ] StateNode and Tooltip map components (scaffolded but empty — logic is in MapView.tsx)

## Conventions
- All UI text labels in CAPS with mono font
- Use `cn()` from lib/utils for conditional classNames
- Use `CATEGORY_CONFIG` and `STATUS_CONFIG` from lib/utils — never hardcode colors
- Server components fetch via Supabase server client, client components use SWR hooks
- New API routes go in app/api/, follow existing pattern (try/catch, ApiResponse<T> shape)
- Urgent resources always sort to top and get visual treatment

## Reference mockups
The original design reference was a 3-panel layout:
- Left: dark sidebar with monospace category filters
- Center: Mapbox dark map with glowing blue resource markers
- Right: sliding resource card panel with AI search

Matches aesthetic of vercel.com — pure black, sharp white borders, IBM Plex Mono everywhere.
