# Hermes Training OS - Database Schema

## Core Philosophy
- Deterministic training logic
- Safety-first validation
- Long-term adaptation patterns
- User authority within engineered limits

## Database Tables

### 1. `users`
Stores user authentication and basic profile information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strava_id BIGINT UNIQUE NOT NULL,
  strava_username VARCHAR(255),
  email VARCHAR(255),
  refresh_token TEXT NOT NULL, -- Encrypted
  access_token TEXT, -- Temporary, refreshed as needed
  access_token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. `runner_profiles`
Core runner metrics and calibration data. Created after 7-day bootcamp.

```sql
CREATE TABLE runner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Calibration metrics (from bootcamp)
  base_pace_seconds_per_km INTEGER NOT NULL, -- e.g., 300 = 5:00/km
  threshold_pace_seconds_per_km INTEGER NOT NULL,
  weekly_capacity_km DECIMAL(5,2) NOT NULL, -- Base weekly volume
  durability_score DECIMAL(3,2) DEFAULT 0.5, -- 0.0 to 1.0
  consistency_score DECIMAL(3,2) DEFAULT 0.5, -- 0.0 to 1.0
  risk_level VARCHAR(20) DEFAULT 'moderate', -- low, moderate, high
  
  -- Current state
  current_state VARCHAR(30) DEFAULT 'Stable', -- Stable, Slump, Probe, Rebuild, Overreach, Injury Watch, Injury Protection, Override Active, Taper
  override_mode_enabled BOOLEAN DEFAULT FALSE,
  
  -- Long-term goals
  primary_goal_distance VARCHAR(20), -- 4K, 10K, Half Marathon, Marathon
  primary_goal_date DATE,
  goal_time_seconds INTEGER, -- Target finish time
  
  -- Adaptation windows
  last_28_day_volume DECIMAL(6,2),
  last_90_day_volume DECIMAL(6,2),
  last_28_day_consistency DECIMAL(3,2),
  
  -- Bootcamp status
  bootcamp_completed BOOLEAN DEFAULT FALSE,
  bootcamp_start_date DATE,
  bootcamp_end_date DATE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3. `long_term_goals`
User-defined goals up to 24 months out.

```sql
CREATE TABLE long_term_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  distance VARCHAR(20) NOT NULL, -- 4K, 10K, Half Marathon, Marathon
  target_date DATE NOT NULL,
  target_time_seconds INTEGER,
  priority INTEGER DEFAULT 1, -- 1 = primary, 2+ = secondary
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4. `roadmaps`
Phased roadmaps generated from long-term goals.

```sql
CREATE TABLE roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  goal_id UUID REFERENCES long_term_goals(id) ON DELETE CASCADE NOT NULL,
  
  phase_number INTEGER NOT NULL,
  phase_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_volume_km DECIMAL(6,2),
  focus VARCHAR(50), -- Base Building, Speed, Endurance, Taper, etc.
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 5. `milestones`
Checkpoints within roadmaps.

```sql
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE NOT NULL,
  
  milestone_name VARCHAR(100) NOT NULL,
  target_date DATE NOT NULL,
  target_metric VARCHAR(50), -- e.g., "20km long run", "5K time trial"
  target_value DECIMAL(8,2),
  achieved BOOLEAN DEFAULT FALSE,
  achieved_date DATE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 6. `workout_templates`
Parameterized workout templates (from Hal Higdon data, not AI-generated).

```sql
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  template_name VARCHAR(100) NOT NULL,
  workout_type VARCHAR(30) NOT NULL, -- Easy Run, Long Run, Tempo, Interval, Recovery, etc.
  distance_type VARCHAR(20), -- fixed_km, time_based, percentage_of_long_run
  base_distance_km DECIMAL(5,2),
  base_duration_minutes INTEGER,
  intensity_zone VARCHAR(20), -- Zone 1, Zone 2, Zone 3, Zone 4, Zone 5, Threshold
  
  -- Parameterization
  min_distance_km DECIMAL(5,2),
  max_distance_km DECIMAL(5,2),
  min_duration_minutes INTEGER,
  max_duration_minutes INTEGER,
  
  -- Usage constraints
  min_week_number INTEGER, -- When in training plan this can appear
  max_week_number INTEGER,
  requires_base_building BOOLEAN DEFAULT FALSE,
  
  -- Source tracking
  source_plan VARCHAR(100), -- e.g., "Hal Higdon Novice 1 Marathon"
  source_week INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 7. `weekly_plans`
Generated weekly training plans.

```sql
CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  week_number INTEGER NOT NULL, -- Week number in current roadmap phase
  
  -- Generation metadata
  state_at_generation VARCHAR(30) NOT NULL,
  total_volume_km DECIMAL(6,2) NOT NULL,
  total_duration_minutes INTEGER NOT NULL,
  
  -- Validation status
  validation_status VARCHAR(20) DEFAULT 'pending', -- pending, valid, repaired, invalid
  validation_errors JSONB, -- Array of validation error objects
  repair_actions JSONB, -- Array of repair actions taken
  
  -- User edits
  user_edited BOOLEAN DEFAULT FALSE,
  user_edit_reason TEXT,
  
  -- Status
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, week_start_date)
);
```

### 8. `workouts`
Individual workouts within weekly plans.

```sql
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_plan_id UUID REFERENCES weekly_plans(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES workout_templates(id),
  
  workout_date DATE NOT NULL,
  workout_type VARCHAR(30) NOT NULL,
  planned_distance_km DECIMAL(5,2),
  planned_duration_minutes INTEGER,
  planned_pace_seconds_per_km INTEGER,
  intensity_zone VARCHAR(20),
  
  -- Actual execution (from Strava)
  strava_activity_id BIGINT,
  actual_distance_km DECIMAL(5,2),
  actual_duration_seconds INTEGER,
  actual_pace_seconds_per_km INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  
  -- User modifications
  user_modified BOOLEAN DEFAULT FALSE,
  user_modification_reason TEXT,
  
  -- Order in week
  day_of_week INTEGER NOT NULL, -- 0 = Sunday, 6 = Saturday
  order_in_week INTEGER NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 9. `strava_activities`
Synced Strava activity data.

```sql
CREATE TABLE strava_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  strava_activity_id BIGINT UNIQUE NOT NULL,
  activity_type VARCHAR(50) NOT NULL, -- Run, Ride, etc.
  
  name VARCHAR(255),
  distance_meters DECIMAL(8,2) NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  total_elevation_gain DECIMAL(6,2),
  start_date TIMESTAMP NOT NULL,
  start_date_local TIMESTAMP NOT NULL,
  
  -- Pace data
  average_speed_ms DECIMAL(6,3), -- meters per second
  max_speed_ms DECIMAL(6,3),
  
  -- Heart rate (if available)
  average_heartrate INTEGER,
  max_heartrate INTEGER,
  
  -- Power (if available)
  weighted_average_watts DECIMAL(6,2),
  
  -- Metadata
  external_id VARCHAR(255),
  upload_id BIGINT,
  synced_at TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10. `health_records`
Health and injury tracking.

```sql
CREATE TABLE health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  record_date DATE NOT NULL,
  record_type VARCHAR(30) NOT NULL, -- injury, pain, fatigue, illness, other
  
  -- Injury/Pain details
  body_part VARCHAR(50), -- knee, ankle, shin, etc.
  severity INTEGER, -- 1-10 scale
  description TEXT,
  
  -- Impact on training
  training_modification VARCHAR(50), -- reduced_volume, reduced_intensity, rest, none
  days_off INTEGER DEFAULT 0,
  
  -- Strike system
  strike_count INTEGER DEFAULT 0, -- Increments for repeated issues
  is_chronic BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 11. `health_strikes`
Progressive strike system for injury patterns.

```sql
CREATE TABLE health_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  strike_type VARCHAR(30) NOT NULL, -- injury_repeat, overreach_pattern, chronic_risk
  strike_count INTEGER NOT NULL,
  body_part VARCHAR(50), -- If injury-related
  issued_at TIMESTAMP DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  
  -- Consequences
  forced_recovery_days INTEGER,
  permanent_limit_applied BOOLEAN DEFAULT FALSE,
  limit_description TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 12. `compliance_check_ins`
Context check-ins when compliance drops.

```sql
CREATE TABLE compliance_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  check_in_date DATE NOT NULL,
  trigger_reason VARCHAR(50), -- low_compliance, missed_workouts, etc.
  
  -- User response
  response_type VARCHAR(50), -- busy, sick, sore, burnout, motivation_loss, preference_change, other
  response_details TEXT,
  
  -- Impact on adaptation
  adaptation_action VARCHAR(50), -- grace_period, probe_phase, restructure_offered, none
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 13. `weekly_summaries`
Rolling window metrics and summaries.

```sql
CREATE TABLE weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Volume metrics
  planned_volume_km DECIMAL(6,2),
  actual_volume_km DECIMAL(6,2),
  compliance_percentage DECIMAL(5,2),
  
  -- Intensity distribution
  easy_run_km DECIMAL(6,2),
  quality_session_km DECIMAL(6,2),
  long_run_km DECIMAL(6,2),
  recovery_km DECIMAL(6,2),
  
  -- Performance metrics
  average_pace_seconds_per_km DECIMAL(6,2),
  threshold_pace_estimate DECIMAL(6,2),
  
  -- Health status
  health_issues_count INTEGER DEFAULT 0,
  rest_days INTEGER DEFAULT 0,
  
  -- State at end of week
  ending_state VARCHAR(30),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, week_start_date)
);
```

### 14. `adaptation_history`
Log of state transitions and adaptations.

```sql
CREATE TABLE adaptation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  transition_date DATE NOT NULL,
  from_state VARCHAR(30),
  to_state VARCHAR(30),
  
  trigger_reason VARCHAR(100),
  trigger_data JSONB, -- Detailed trigger information
  
  -- Adaptation details
  volume_change_percentage DECIMAL(5,2),
  intensity_change_percentage DECIMAL(5,2),
  adaptation_rationale TEXT,
  
  -- Windows used
  window_7_day JSONB,
  window_28_day JSONB,
  window_90_day JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 15. `momentum_meter`
Consistency tracking for motivation.

```sql
CREATE TABLE momentum_meter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  consistency_score DECIMAL(3,2) DEFAULT 0.0, -- 0.0 to 1.0
  
  last_updated DATE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 16. `killa_meter`
Overreach and breakthrough tracking.

```sql
CREATE TABLE killa_meter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  overreach_count INTEGER DEFAULT 0,
  breakthrough_count INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  
  last_updated DATE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_users_strava_id ON users(strava_id);
CREATE INDEX idx_runner_profiles_user_id ON runner_profiles(user_id);
CREATE INDEX idx_weekly_plans_user_date ON weekly_plans(user_id, week_start_date);
CREATE INDEX idx_workouts_plan_date ON workouts(weekly_plan_id, workout_date);
CREATE INDEX idx_strava_activities_user_date ON strava_activities(user_id, start_date);
CREATE INDEX idx_health_records_user_date ON health_records(user_id, record_date);
CREATE INDEX idx_weekly_summaries_user_date ON weekly_summaries(user_id, week_start_date);
CREATE INDEX idx_adaptation_history_user_date ON adaptation_history(user_id, transition_date);
```

## Relationships Summary

- `users` → `runner_profiles` (1:1)
- `users` → `long_term_goals` (1:many)
- `users` → `weekly_plans` (1:many)
- `users` → `strava_activities` (1:many)
- `users` → `health_records` (1:many)
- `long_term_goals` → `roadmaps` (1:many)
- `roadmaps` → `milestones` (1:many)
- `weekly_plans` → `workouts` (1:many)
- `workout_templates` → `workouts` (1:many, optional)
