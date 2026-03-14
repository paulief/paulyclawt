# 🏋️ Fitness Tracker

A conversational fitness tracker powered by OpenClaw. Log workouts via natural language in Telegram, query progress, and get recommendations.

## How It Works

- **Storage:** SQLite database (`fitness.db`) with normalized exercises and workout entries
- **Interface:** Chat-based — just message your workout in natural language
- **Querying:** Ask about progress, PRs, weekly summaries, etc.

## Database Schema

### `exercises`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | Exercise name (case-insensitive unique) |

### `workouts`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| exercise_id | INTEGER | FK → exercises |
| logged_at | TEXT | ISO timestamp |
| sets | INTEGER | Number of sets |
| reps | INTEGER | Reps per set |
| weight | REAL | Weight used |
| weight_unit | TEXT | 'lbs' or 'kg' |
| duration_sec | INTEGER | For timed exercises |
| distance | REAL | For cardio |
| distance_unit | TEXT | 'mi', 'km', etc. |
| notes | TEXT | Freeform notes |

## API (db.py)

```python
from db import log_workout, query_exercise_history, query_recent, personal_records, exercise_volume_trend

# Log a workout
log_workout("bench press", sets=3, reps=10, weight=185)

# Get history for an exercise
query_exercise_history("bench press", limit=10)

# Recent workouts (last 7 days)
query_recent(days=7)

# Personal records
personal_records()

# Volume trend (weekly, last 8 weeks)
exercise_volume_trend("bench press", weeks=8)
```

## Files

- `db.py` — Database layer (auto-creates `fitness.db` on import)
- `fitness.db` — SQLite database (created at runtime, gitignored)
