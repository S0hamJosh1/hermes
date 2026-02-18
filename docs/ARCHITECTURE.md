# Hermes Training OS - Architecture Overview

## Core Philosophy

**"The algorithm is the brain, AI is only the interface, and the user is the authority within engineered limits."**

### Key Principles

1. **Deterministic Training Logic**: All training decisions are algorithmic, not AI-generated
2. **Safety-First Validator**: Hard rules cannot be disabled; soft rules can be overridden
3. **Long-Term Adaptation**: Uses 28-day and 90-day rolling windows, ignores short-term noise
4. **User Authority**: Users can override limits via "Send It" mode, but safety systems remain active
5. **AI as Interface Only**: Local SLM only parses user intent into structured JSON, never makes training decisions

## System Components

### 1. Planning Algorithm

**Deterministic, template-based planning**
- Uses predefined, parameterized workout templates (from Hal Higdon data)
- No AI-generated workouts
- Templates are selected and scaled based on:
  - Current state (Stable, Slump, Probe, etc.)
  - Weekly capacity
  - Phase in roadmap
  - Injury protection status

**Weekly Plan Generation Flow:**
1. Determine target volume based on state and roadmap phase
2. Select appropriate workout templates
3. Distribute workouts across week (respecting hard-day spacing)
4. Scale distances/durations to match target volume
5. Assign intensity zones based on current fitness metrics

### 2. Safety Validator

**Hard Rules (Cannot be disabled):**
- Ramp limits (max % increase per week)
- Hard-day spacing (min days between quality sessions)
- Injury locks (forced rest/reduced volume)
- Taper protection (no intensity increases before race)
- Overreach detection (automatic recovery triggers)

**Soft Rules (Can be overridden):**
- Preferred training days
- Time caps
- Intensity preferences
- Workout type preferences

**Auto-Repair System:**
- When constraints are violated, automatically adjusts plan
- Logs all repair actions
- Preserves user intent where possible

### 3. State Machine

**States:**
- **Stable**: Normal training, consistent performance
- **Slump**: Performance decline, reduced volume
- **Probe**: Testing capacity after recovery
- **Rebuild**: Gradual return after extended break
- **Overreach**: Too much too soon, forced recovery
- **Injury Watch**: Monitoring for injury patterns
- **Injury Protection**: Active injury, reduced training
- **Override Active**: User-enabled aggressive mode
- **Taper**: Pre-race reduction phase

**Transition Logic:**
- Based on 7/28/90-day rolling windows
- Never makes major changes from short-term inconsistency
- Grace periods before downgrades
- Probe phases before upgrades

### 4. Adaptation Engine

**Adaptation Triggers:**
- Performance trends (28+ day windows)
- Compliance patterns
- Health signals
- User goals/roadmap milestones

**Adaptation Actions:**
- Volume adjustments (±X%)
- Intensity adjustments
- Template selection changes
- State transitions

**Never Adapts On:**
- Single bad workout
- Week of missed runs
- Short-term inconsistency
- User complaints without data

### 5. Health & Injury System

**Health Strike System:**
- Tracks injury/pain signals
- Progressive warnings (strike 1, 2, 3)
- Forced recovery after repeated issues
- Chronic patterns → permanent limits

**Injury Protection:**
- Body-part specific locks
- Reduced volume/intensity
- Extended recovery periods
- Cannot be disabled (safety system)

**Health Tracking:**
- Pain/injury records
- Fatigue markers
- Illness tracking
- Strike history

### 6. Compliance & Context System

**Compliance Tracking:**
- Planned vs. actual volume
- Workout completion rate
- Consistency scoring

**Context Check-Ins:**
When compliance drops, system asks:
- Busy?
- Sick?
- Sore?
- Burnout?
- Motivation loss?
- Preference change?
- Other?

**Adaptation Based on Context:**
- Busy → Grace period, reduced plan
- Sick → Recovery mode
- Sore → Injury watch
- Burnout → Probe phase, restructure offer
- Motivation loss → Check-in, adjust goals
- Preference change → Alternative templates (e.g., 2-day plans)

**Pattern Detection:**
- If user skips easy runs but improves → Detect over 28 days
- Offer alternative templates
- Show performance tradeoffs
- Tighten fatigue monitoring
- Don't force compliance

### 7. Long-Term Roadmaps

**Roadmap Generation:**
- Based on user goals (up to 24 months)
- Phased approach (Base → Build → Peak → Taper)
- Milestones and checkpoints
- No "impossible" language, only feasibility data

**Milestone Tracking:**
- Target dates
- Target metrics (e.g., "20km long run")
- Achievement status
- Performance against roadmap

### 8. Bootcamp Calibration

**7-Day Bootcamp Phase:**
For new or inconsistent runners:
- Collect 7 days of activity data
- Calculate base metrics:
  - Base pace (easy run pace)
  - Threshold pace (estimated)
  - Weekly capacity
  - Durability score
  - Consistency score
  - Risk level

**Profile Generation:**
- Creates runner profile
- Sets initial state
- Generates first roadmap

### 9. Strava Integration

**OAuth Flow:**
- Strava OAuth authentication
- Secure token storage (refresh tokens)
- Automatic token refresh

**Activity Syncing:**
- Polling (default, every 15 minutes)
- Optional webhooks (real-time)
- Syncs all run activities
- Parses pace, distance, duration, heart rate

**Data Usage:**
- Updates actual vs. planned metrics
- Calculates performance trends
- Feeds into adaptation engine
- Never used for SLM training data

### 10. Local SLM Integration

**Purpose:**
- Parse user intent into structured JSON edits
- Ask clarifying questions
- Never generate workouts
- Never make training decisions
- Never give medical advice

**Fine-Tuning:**
- Only on intent-to-JSON data
- No Strava data used
- No training knowledge injected

**Example Use Cases:**
- User: "I want to run more this week"
- SLM: Parses → `{ volumeIncrease: 0.15, reason: "user_request" }`
- Algorithm: Validates, applies if safe

## Weekly Pipeline

**Fixed weekly cycle:**

1. **Import Strava Data**
   - Sync activities from Strava
   - Match to planned workouts
   - Update completion status

2. **Update Metrics**
   - Calculate 7/28/90-day rolling windows
   - Update compliance scores
   - Calculate performance trends
   - Update pace estimates

3. **Health Checks**
   - Evaluate injury/pain records
   - Check strike status
   - Determine health state

4. **Assign State**
   - Evaluate state machine
   - Determine current state
   - Check for transitions

5. **Apply User Edits**
   - Process any user modifications
   - Parse via SLM if needed
   - Apply edits to plan

6. **Validate & Repair**
   - Run validator
   - Check all hard/soft rules
   - Auto-repair violations
   - Log all actions

7. **Publish Plan**
   - Make plan visible to user
   - Send notifications
   - Update dashboard

8. **Generate Feedback**
   - Create weekly summary
   - Highlight achievements
   - Show compliance
   - Provide insights

## Data Flow

```
Strava API → Activity Sync → Database
                                    ↓
User Input → SLM Parser → Structured Edit → Algorithm
                                    ↓
Database ← Validator ← Planner ← State Machine
                                    ↓
                            Weekly Plan → User Dashboard
```

## Security & Privacy

- **Token Storage**: Encrypted refresh tokens
- **Data Privacy**: Strava data never used for SLM training
- **User Control**: Users can export/delete all data
- **Safety Systems**: Cannot be disabled, always active

## Scalability Considerations

- **Serverless**: Next.js API routes on Vercel
- **Database**: PostgreSQL (scales horizontally)
- **Caching**: Weekly plans cached, recalculated on demand
- **Background Jobs**: Strava syncing, plan generation
- **Rate Limiting**: Strava API rate limits respected

## Development Phases

### Phase 1: Foundation
- [ ] Database setup (Prisma)
- [ ] Strava OAuth
- [ ] Basic activity syncing
- [ ] Simple plan generation
- [ ] Basic validator

### Phase 2: Core Algorithm
- [ ] State machine
- [ ] Adaptation engine
- [ ] Template system
- [ ] Advanced validator
- [ ] Auto-repair

### Phase 3: Health & Safety
- [ ] Injury tracking
- [ ] Strike system
- [ ] Health protection
- [ ] Compliance system

### Phase 4: Intelligence
- [ ] Local SLM integration
- [ ] Intent parsing
- [ ] Context check-ins
- [ ] Pattern detection

### Phase 5: Polish
- [ ] UI/UX refinement
- [ ] Performance optimization
- [ ] Documentation
- [ ] Testing
