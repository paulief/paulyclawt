"""
Fitness Tracker – database layer
SQLite-backed storage for workout logs.
"""

import sqlite3
import os
from datetime import datetime, date
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "fitness.db")


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't exist."""
    with _conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS exercises (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL UNIQUE COLLATE NOCASE
            );

            CREATE TABLE IF NOT EXISTS workouts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                exercise_id INTEGER NOT NULL REFERENCES exercises(id),
                logged_at   TEXT NOT NULL DEFAULT (datetime('now')),
                sets        INTEGER,
                reps        INTEGER,
                weight      REAL,
                weight_unit TEXT DEFAULT 'lbs',
                duration_sec INTEGER,
                distance    REAL,
                distance_unit TEXT,
                notes       TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_workouts_exercise
                ON workouts(exercise_id);
            CREATE INDEX IF NOT EXISTS idx_workouts_date
                ON workouts(logged_at);
        """)


def get_or_create_exercise(name: str) -> int:
    """Return exercise id, creating if needed."""
    name = name.strip()
    with _conn() as conn:
        row = conn.execute(
            "SELECT id FROM exercises WHERE name = ? COLLATE NOCASE", (name,)
        ).fetchone()
        if row:
            return row["id"]
        cur = conn.execute("INSERT INTO exercises (name) VALUES (?)", (name,))
        return cur.lastrowid


def log_workout(
    exercise: str,
    sets: Optional[int] = None,
    reps: Optional[int] = None,
    weight: Optional[float] = None,
    weight_unit: str = "lbs",
    duration_sec: Optional[int] = None,
    distance: Optional[float] = None,
    distance_unit: Optional[str] = None,
    notes: Optional[str] = None,
    logged_at: Optional[str] = None,
) -> int:
    """Log a workout entry. Returns the new workout row id."""
    ex_id = get_or_create_exercise(exercise)
    ts = logged_at or datetime.now().isoformat(timespec="seconds")
    with _conn() as conn:
        cur = conn.execute(
            """INSERT INTO workouts
               (exercise_id, logged_at, sets, reps, weight, weight_unit,
                duration_sec, distance, distance_unit, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (ex_id, ts, sets, reps, weight, weight_unit,
             duration_sec, distance, distance_unit, notes),
        )
        return cur.lastrowid


def query_exercise_history(
    exercise: str,
    limit: int = 20,
    since: Optional[str] = None,
) -> list[dict]:
    """Return recent entries for a given exercise."""
    ex_id_row = None
    with _conn() as conn:
        ex_id_row = conn.execute(
            "SELECT id FROM exercises WHERE name = ? COLLATE NOCASE",
            (exercise.strip(),),
        ).fetchone()
        if not ex_id_row:
            return []

        sql = """
            SELECT w.*, e.name as exercise
            FROM workouts w
            JOIN exercises e ON e.id = w.exercise_id
            WHERE w.exercise_id = ?
        """
        params: list = [ex_id_row["id"]]
        if since:
            sql += " AND w.logged_at >= ?"
            params.append(since)
        sql += " ORDER BY w.logged_at DESC LIMIT ?"
        params.append(limit)

        return [dict(r) for r in conn.execute(sql, params).fetchall()]


def query_recent(days: int = 7, limit: int = 50) -> list[dict]:
    """Return all workouts from the last N days."""
    since = date.today().isoformat()  # fallback
    from datetime import timedelta
    since = (date.today() - timedelta(days=days)).isoformat()
    with _conn() as conn:
        rows = conn.execute(
            """SELECT w.*, e.name as exercise
               FROM workouts w
               JOIN exercises e ON e.id = w.exercise_id
               WHERE w.logged_at >= ?
               ORDER BY w.logged_at DESC
               LIMIT ?""",
            (since, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def personal_records() -> list[dict]:
    """Return max weight per exercise (where weight is tracked)."""
    with _conn() as conn:
        rows = conn.execute(
            """SELECT e.name as exercise,
                      MAX(w.weight) as max_weight,
                      w.weight_unit,
                      w.reps as reps_at_max,
                      w.logged_at
               FROM workouts w
               JOIN exercises e ON e.id = w.exercise_id
               WHERE w.weight IS NOT NULL
               GROUP BY w.exercise_id
               ORDER BY e.name"""
        ).fetchall()
        return [dict(r) for r in rows]


def exercise_volume_trend(exercise: str, weeks: int = 8) -> list[dict]:
    """
    Weekly total volume (sets * reps * weight) for an exercise.
    Useful for spotting plateaus and progressive overload.
    """
    from datetime import timedelta
    since = (date.today() - timedelta(weeks=weeks)).isoformat()
    with _conn() as conn:
        ex_row = conn.execute(
            "SELECT id FROM exercises WHERE name = ? COLLATE NOCASE",
            (exercise.strip(),),
        ).fetchone()
        if not ex_row:
            return []
        rows = conn.execute(
            """SELECT strftime('%Y-W%W', logged_at) as week,
                      SUM(sets * reps * weight) as total_volume,
                      MAX(weight) as max_weight,
                      COUNT(*) as sessions
               FROM workouts
               WHERE exercise_id = ? AND logged_at >= ?
                     AND weight IS NOT NULL
               GROUP BY week
               ORDER BY week""",
            (ex_row["id"], since),
        ).fetchall()
        return [dict(r) for r in rows]


def all_exercises() -> list[str]:
    """List all tracked exercise names."""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT name FROM exercises ORDER BY name"
        ).fetchall()
        return [r["name"] for r in rows]


def delete_workout(workout_id: int) -> bool:
    """Delete a workout entry by id. Returns True if deleted."""
    with _conn() as conn:
        cur = conn.execute("DELETE FROM workouts WHERE id = ?", (workout_id,))
        return cur.rowcount > 0


# Auto-init on import
init_db()
