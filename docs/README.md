# Hermes Training OS

A web-based, free, long-term adaptive running training system for 4K, 10K, Half Marathon, and Marathon runners.

## Overview

Hermes is a **Training Operating System** built on deterministic planning algorithms, not an AI chatbot coach. The core philosophy is:

> **"The algorithm is the brain, AI is only the interface, and the user is the authority within engineered limits."**

## Key Features

- 🎯 **Deterministic Planning Algorithm**: Template-based workout generation (no AI-generated workouts)
- 🛡️ **Safety-First Validator**: Hard rules cannot be disabled; soft rules can be overridden
- 📊 **Long-Term Adaptation**: Uses 28-day and 90-day rolling windows, ignores short-term noise
- 🏃 **Strava Integration**: Real performance data via OAuth and activity syncing
- 🗺️ **Long-Term Roadmaps**: Phased plans up to 24 months with milestones
- 💪 **Health & Injury Management**: Strike system, forced recovery, chronic pattern detection
- 🎨 **Motivation Systems**: Momentum Meter (consistency) and Killa Meter (breakthroughs)
- 🤖 **Local SLM Integration**: Parses user intent only, never makes training decisions

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Database Schema

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for complete database structure.

## Project Structure

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for directory layout and module organization.

## Development Status

### ✅ Completed
- Database schema design
- Project structure setup
- Type definitions
- Architecture documentation

### 🚧 In Progress
- Project structure implementation

### 📋 Planned
- Database setup (Prisma)
- Strava OAuth integration
- Core algorithm modules
- Health & injury system
- Weekly pipeline
- Local SLM integration

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (via Prisma)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (serverless)
- **Authentication**: Strava OAuth
- **AI**: Local Small Language Model (for intent parsing only)

## Core Principles

1. **Observe, Verify, Adapt, and Protect**: Never guess, never blindly trust data or user input
2. **Deterministic Logic**: All training decisions are algorithmic
3. **Safety First**: Injury protection and chronic risk detection always active
4. **Long-Term Focus**: Adaptations based on 28/90-day patterns, not weekly fluctuations
5. **User Authority**: Users can override limits, but safety systems remain
6. **AI as Interface**: SLM only parses intent, never generates workouts or makes decisions

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Strava API credentials

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL="postgresql://..."
STRAVA_CLIENT_ID="..."
STRAVA_CLIENT_SECRET="..."
STRAVA_REDIRECT_URI="..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Development

```bash
npm run dev
```

## Training Plans

Training plans are based on Hal Higdon's methodology, stored as parameterized workout templates. The system uses these templates to generate personalized weekly plans based on:

- Current fitness level
- Training phase
- Injury status
- Long-term goals

## License

[To be determined]

## Contributing

[To be determined]
