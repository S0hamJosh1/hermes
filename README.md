# Hermes

Adaptive running coach that turns Strava history into safe, personalized weekly training plans, then adjusts those plans with coaching logic and AI-assisted edits.

## Why Hermes

Most running plans are static. Hermes is designed to adapt:

- Syncs real Strava activity data
- Calibrates pace and capacity from your running history
- Builds weekly plans from proven templates
- Enforces safety constraints before publishing
- Adjusts recommendations using compliance, health, and training state
- Supports natural-language plan edits through Hermes Chat

## Core Features

- Strava OAuth sign-in and activity sync
- Auto-calibration and onboarding bootcamp for low-history runners
- Goal-driven roadmap generation with milestones
- Weekly plan generation with validation and auto-repair
- Health and injury reporting with progressive protection logic
- Compliance tracking and adaptive state transitions
- AI chat intents for plan edits (volume change, reschedule, skip, health report)

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- PostgreSQL + Prisma
- Google Gemini API (for chat and intent support)
- Tailwind CSS v4
- Radix UI icons

## Screenshots

Add your product screenshots here (dashboard, plan view, roadmap, chat, onboarding).

```md
![Dashboard](docs/screenshots/dashboard.png)
![Weekly Plan](docs/screenshots/weekly-plan.png)
![Roadmap](docs/screenshots/roadmap.png)
![Chat](docs/screenshots/chat.png)
```

If you want, I can wire these directly once you share image files.

## Branding

If you want to include your Strava-style icon snippet in the README, add it to `docs/branding/icon-snippet.png` and use:

```md
![Hermes Icon](docs/branding/icon-snippet.png)
```

Note: Hermes is not affiliated with or endorsed by Strava.

## Architecture (High Level)

```text
Strava Sync -> Auto Calibration -> Runner Profile
Goal Setup  -> Roadmap          -> Weekly Plan Generation
                                 -> Safety Validation + Auto-Repair
                                 -> Published Weekly Plan
Compliance + Health Signals      -> State Machine -> Next Plan Cycle
```

## Project Structure

```text
src/
  app/
    api/              # auth, sync, plans, roadmap, chat, health, onboarding
    dashboard/        # dashboard UI
    plan/             # weekly plan UI
    roadmap/          # roadmap UI
    chat/             # Hermes chat UI
    onboarding/       # onboarding and bootcamp flow
  lib/
    algorithm/        # planner, validator, repair pipeline
    slm/              # Gemini client + intent parsing
    strava/           # Strava integrations and performance analysis
    state-machine/    # adaptation states and transitions
prisma/
  schema.prisma       # data model
  seed.ts             # workout template seeding
data/
  hal-higdon/         # parsed training plan source data
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Strava API app credentials
- Gemini API key

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Copy `.env.example` to `.env.local`, then set values:

```env
DATABASE_URL=""
DIRECT_DATABASE_URL=""
STRAVA_CLIENT_ID=""
STRAVA_CLIENT_SECRET=""
STRAVA_REDIRECT_URI="http://localhost:3000/api/auth/strava/callback"
SESSION_SECRET=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-flash"
```

### 3) Initialize database

```bash
npm run db:push
npm run db:seed
```

### 4) Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Available Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run test` - run test suite
- `npm run lint` - run ESLint
- `npm run db:generate` - Prisma client generation
- `npm run db:push` - push schema to database
- `npm run db:migrate` - run Prisma migrations
- `npm run db:studio` - open Prisma Studio
- `npm run db:seed` - seed workout templates
- `npm run parse-plans` - parse Hal Higdon source plans
- `npm run verify-hal-truths` - validate parsed plan data

## Current Status

Hermes is an active work in progress. Core plan generation, sync, and chat workflows are in place, with ongoing polish and fixes across UX and edge cases.

## License

MIT
