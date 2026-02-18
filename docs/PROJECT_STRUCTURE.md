# Hermes Training OS - Project Structure

## Directory Layout

```
hermes/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth routes (Strava OAuth)
│   │   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Strava OAuth endpoints
│   │   │   ├── strava/        # Strava sync endpoints
│   │   │   ├── plans/         # Weekly plan endpoints
│   │   │   ├── health/        # Health/injury endpoints
│   │   │   └── adapt/         # Adaptation endpoints
│   │   ├── page.tsx           # Landing page
│   │   └── layout.tsx         # Root layout
│   │
│   ├── lib/
│   │   ├── db/                # Database client & queries
│   │   │   ├── client.ts      # Prisma/DB client
│   │   │   └── queries/       # Database query functions
│   │   ├── strava/            # Strava API integration
│   │   │   ├── client.ts      # Strava API client
│   │   │   ├── oauth.ts       # OAuth flow
│   │   │   └── sync.ts        # Activity syncing
│   │   ├── algorithm/         # Core training algorithm
│   │   │   ├── planner.ts     # Weekly plan generation
│   │   │   ├── validator.ts   # Safety validator
│   │   │   ├── repair.ts      # Constraint repair
│   │   │   └── templates.ts   # Workout template system
│   │   ├── state-machine/     # Adaptation state machine
│   │   │   ├── states.ts      # State definitions
│   │   │   ├── transitions.ts # State transition logic
│   │   │   └── adapt.ts       # Adaptation logic
│   │   ├── health/            # Health & injury system
│   │   │   ├── tracker.ts     # Health tracking
│   │   │   ├── strikes.ts     # Strike system
│   │   │   └── protection.ts  # Injury protection
│   │   ├── metrics/           # Performance metrics
│   │   │   ├── calculator.ts  # Pace/volume calculations
│   │   │   ├── windows.ts     # Rolling window calculations
│   │   │   └── compliance.ts  # Compliance tracking
│   │   └── slm/               # Local SLM integration
│   │       ├── client.ts      # SLM client
│   │       └── parser.ts      # Intent-to-JSON parser
│   │
│   ├── types/                  # TypeScript type definitions
│   │   ├── database.ts        # Database types
│   │   ├── strava.ts          # Strava API types
│   │   ├── training.ts        # Training domain types
│   │   └── algorithm.ts       # Algorithm types
│   │
│   ├── components/             # React components
│   │   ├── ui/                # Base UI components
│   │   ├── dashboard/         # Dashboard components
│   │   ├── plans/             # Plan display components
│   │   ├── health/            # Health tracking components
│   │   └── motivation/        # Momentum/Killa meters
│   │
│   └── utils/                 # Utility functions
│       ├── validation.ts      # Input validation
│       └── formatting.ts     # Data formatting
│
├── prisma/                     # Prisma schema & migrations
│   ├── schema.prisma
│   └── migrations/
│
├── data/                       # Training plan data
│   └── hal-higdon/            # Hal Higdon plans (markdown)
│
├── docs/                       # Documentation
│   ├── DATABASE_SCHEMA.md
│   ├── PROJECT_STRUCTURE.md
│   ├── ALGORITHM.md           # Algorithm documentation
│   └── API.md                 # API documentation
│
└── tests/                      # Test files
    ├── unit/
    └── integration/
```

## Core Modules

### 1. Database Layer (`lib/db/`)
- Prisma client setup
- Type-safe database queries
- Transaction handling

### 2. Strava Integration (`lib/strava/`)
- OAuth flow
- Token refresh
- Activity syncing (polling + webhooks)
- Activity parsing

### 3. Training Algorithm (`lib/algorithm/`)
- **Planner**: Generates weekly plans from templates
- **Validator**: Enforces hard/soft rules
- **Repair**: Auto-fixes constraint violations
- **Templates**: Manages workout template library

### 4. State Machine (`lib/state-machine/`)
- State definitions (Stable, Slump, Probe, etc.)
- Transition logic
- Adaptation decisions based on state

### 5. Health System (`lib/health/`)
- Injury/pain tracking
- Strike system
- Forced recovery logic
- Chronic pattern detection

### 6. Metrics (`lib/metrics/`)
- Rolling window calculations (7/28/90 day)
- Pace calculations
- Volume tracking
- Compliance scoring

### 7. SLM Integration (`lib/slm/`)
- Intent parsing (user edits → JSON)
- Clarifying questions
- Never generates workouts or training decisions

## Weekly Pipeline Flow

1. **Import Strava Data** → Sync activities from Strava
2. **Update Metrics** → Calculate rolling windows, compliance, performance
3. **Health Checks** → Evaluate injury/health status
4. **Assign State** → Determine current state machine state
5. **Apply User Edits** → Process any user modifications (via SLM parser)
6. **Validate & Repair** → Run validator, auto-repair violations
7. **Publish Plan** → Make plan visible to user
8. **Generate Feedback** → Create summary and insights

## Key Principles

- **Deterministic Logic**: All training decisions are algorithmic
- **Safety First**: Validator always runs, cannot be disabled
- **Long-term Focus**: Adaptations use 28/90-day windows, not short-term noise
- **User Authority**: Users can override limits, but safety systems remain
- **AI as Interface**: SLM only parses intent, never makes training decisions
