<p align="center">
  <h1 align="center">⚡ Hermes — Training OS</h1>
  <p align="center">
    An intelligent, adaptive running coach powered by AI and real-time Strava data.
  </p>
</p>

---

## Overview

Hermes is a full-stack training platform that generates personalized running plans, adapts in real time based on performance data, and provides an AI-powered coaching assistant. Built with Next.js 16, Prisma, PostgreSQL, and the Google Gemini API.

### Key Features

- **Strava OAuth & Sync** — Connect your Strava account and auto-import run activities
- **Auto-Calibration** — Analyze historical data to calibrate pace, capacity, and fitness level
- **7-Day Bootcamp** — Guided onboarding flow for runners without sufficient Strava history
- **Adaptive Plan Generation** — Weekly training plans based on Hal Higdon templates, personalized to your fitness
- **State Machine** — Tracks your training state (Stable, Slump, Probe, Rebuild, Overreach, Taper, etc.)
- **Safety Validator & Auto-Repair** — Enforces ramp-rate limits, injury constraints, and auto-fixes violations
- **Health Tracking** — Report injuries/pain with a 3-strike progressive protection system
- **Compliance Monitoring** — Tracks plan adherence with context-aware check-ins
- **AI Chat (Hermes Chat)** — Conversational assistant powered by Gemini with intent parsing for plan modifications
- **Roadmap Visualization** — Winding-road SVG roadmap showing training phases and milestone checkpoints
- **Goal Setting** — Set race distance, date, and target time with multi-goal support

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Database** | PostgreSQL via Prisma ORM |
| **AI** | Google Gemini API |
| **Auth** | Strava OAuth 2.0 (custom session cookies) |
| **Styling** | Tailwind CSS v4 + Glassmorphism design system |
| **Icons** | Radix UI Icons |
| **Deployment** | Vercel-ready |

---

## Project Structure

```
hermes/
├── prisma/                    # Database schema & migrations
│   └── schema.prisma          # 17 models (User, RunnerProfile, WeeklyPlan, etc.)
├── data/
│   └── hal-higdon/            # Training plan templates (5K–Marathon, Novice–Advanced)
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # OAuth, session, logout
│   │   │   ├── chat/          # AI chat + intent handling
│   │   │   ├── dashboard/     # Dashboard data aggregation
│   │   │   ├── plans/         # Plan generation, editing, retrieval
│   │   │   ├── roadmap/       # Roadmap phases & milestones
│   │   │   ├── sync/          # Strava activity sync
│   │   │   └── ...            # Health, compliance, onboarding, etc.
│   │   ├── dashboard/         # Main dashboard page
│   │   ├── plan/              # Weekly plan view
│   │   ├── roadmap/           # Training roadmap visualization
│   │   ├── chat/              # AI chat interface
│   │   ├── onboarding/        # Goal setting & bootcamp
│   │   └── health/            # Injury reporting
│   ├── lib/
│   │   ├── algorithm/         # Core training algorithm
│   │   │   ├── planner.ts     # Weekly plan generation
│   │   │   ├── validator.ts   # Safety rule enforcement
│   │   │   ├── repair.ts      # Auto-repair for violations
│   │   │   └── types.ts       # Algorithm type definitions
│   │   ├── slm/               # AI/LLM integration
│   │   │   ├── client.ts      # Gemini API client
│   │   │   ├── intent-parser.ts  # Natural language → training actions
│   │   │   ├── prompts.ts     # System prompts
│   │   │   └── context-checkin.ts # Smart check-in triggers
│   │   ├── auth/              # Session & cookie management
│   │   ├── strava/            # Strava API & performance analysis
│   │   ├── plans/             # Plan editing logic
│   │   └── db/                # Prisma client
│   └── components/
│       ├── navigation/        # Sidebar, mobile drawer, app shell
│       └── ui/                # Glass panels, reusable UI
└── scripts/                   # Data processing & verification scripts
```

---

## Architecture

### Training Algorithm Pipeline

```
Strava Data → Auto-Calibration → Runner Profile
                                       ↓
Goal Setting → Roadmap Phases → Weekly Plan Generation
                                       ↓
                              Safety Validator → Auto-Repair
                                       ↓
                              Published Weekly Plan
                                       ↓
                    Compliance Tracking → State Machine → Next Week
```

### State Machine

The runner state machine tracks training status and adapts accordingly:

| State | Description |
|-------|------------|
| **Stable** | Normal training, progressing as planned |
| **Slump** | Declining compliance, may reduce volume |
| **Probe** | Testing higher capacity after consistent training |
| **Rebuild** | Recovering from injury or extended break |
| **Overreach** | Pushing limits with extra monitoring |
| **Injury Watch** | Active injury with modified training |
| **Injury Protection** | Severe injury, forced recovery |
| **Taper** | Race preparation, reduced volume |

### AI Chat Intent System

Hermes Chat parses natural language into actionable intents:

- `volume_change` — Adjust weekly mileage up/down
- `plan_level_change` — Switch base plan difficulty
- `skip_workout` — Mark a workout as skipped
- `reschedule` — Move a workout to a different day
- `modify_workout` — Change workout parameters
- `report_health` — Log injury or pain
- `ask_question` — General training Q&A

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Strava API app (for OAuth)
- Google Gemini API key

### Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/hermes"
DIRECT_DATABASE_URL="postgresql://user:password@host:5432/hermes"

# Strava OAuth
STRAVA_CLIENT_ID="your_client_id"
STRAVA_CLIENT_SECRET="your_client_secret"
STRAVA_REDIRECT_URI="http://localhost:3000/api/auth/strava/callback"

# AI
GEMINI_API_KEY="your_gemini_api_key"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SESSION_SECRET="your_session_secret"
```

### Installation

```bash
# Install dependencies
npm install

# Set up database
npx prisma db push

# Seed training plan templates
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to get started.

### Available Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (includes Prisma generate) |
| `npm run test` | Run test suite |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed workout templates |

---

## Design

Hermes uses a **dark glassmorphism** design system with:

- Frosted glass panels with subtle white borders
- Dark layered background
- Neutral white/gray color palette (no accent colors)
- Radix UI icons throughout
- Responsive layout with sidebar (desktop) and drawer (mobile)

---

## License

MIT
