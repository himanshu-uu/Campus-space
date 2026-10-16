import sqlite3
import pandas as pd
from pathlib import Path
from contextlib import contextmanager
from Backend.config.settings import settings

def get_db_connection():
    conn = sqlite3.connect(str(settings.DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def db_session():
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db(force_reseed: bool = False):
    """
    Initializes SQLite tables and seeds static CSV data if not already present.
    """
    settings.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_db_connection()
    cur = conn.cursor()

    # 1. Rooms Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS rooms (
        room_id TEXT PRIMARY KEY,
        building TEXT NOT NULL,
        floor INTEGER NOT NULL,
        room_type TEXT NOT NULL,
        capacity INTEGER NOT NULL,
        projector INTEGER DEFAULT 0,
        computers INTEGER DEFAULT 0,
        accessible INTEGER DEFAULT 0,
        power_outlets INTEGER DEFAULT 0
    );
    """)

    # 2. Class Schedule Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS class_schedule (
        schedule_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        course_code TEXT NOT NULL,
        weekday TEXT NOT NULL,
        start_hour INTEGER NOT NULL,
        duration_hours INTEGER NOT NULL,
        expected_attendance INTEGER NOT NULL,
        department TEXT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    );
    """)

    # 3. Events Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration_hours INTEGER NOT NULL,
        expected_attendance INTEGER NOT NULL,
        actual_attendance INTEGER,
        FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    );
    """)

    # 4. Room Requests Table (Supports persistent student/club/admin submissions)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS room_requests (
        request_id TEXT PRIMARY KEY,
        requester_name TEXT,
        requester_type TEXT DEFAULT 'student',
        request_date TEXT NOT NULL,
        start_hour INTEGER NOT NULL,
        duration_hours INTEGER NOT NULL,
        required_capacity INTEGER NOT NULL,
        projector_required INTEGER DEFAULT 0,
        computers_required INTEGER DEFAULT 0,
        accessible_required INTEGER DEFAULT 0,
        purpose TEXT,
        status TEXT DEFAULT 'Pending',
        allocated_room_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (allocated_room_id) REFERENCES rooms(room_id)
    );
    """)

    # Check if rooms are populated
    cur.execute("SELECT COUNT(*) FROM rooms")
    room_count = cur.fetchone()[0]

    if room_count == 0 or force_reseed:
        print("[DB] Seeding database from CSVs in data directory...")

        rooms_csv = settings.DATA_DIR / "rooms.csv"
        if rooms_csv.exists():
            df_rooms = pd.read_csv(rooms_csv)
            df_rooms.to_sql("rooms", conn, if_exists="replace", index=False)
            print(f"[DB] Loaded {len(df_rooms)} rooms.")

        sched_csv = settings.DATA_DIR / "class_schedule.csv"
        if sched_csv.exists():
            df_sched = pd.read_csv(sched_csv)
            df_sched.to_sql("class_schedule", conn, if_exists="replace", index=False)
            print(f"[DB] Loaded {len(df_sched)} schedule records.")

        events_csv = settings.DATA_DIR / "events.csv"
        if events_csv.exists():
            df_events = pd.read_csv(events_csv)
            df_events.to_sql("events", conn, if_exists="replace", index=False)
            print(f"[DB] Loaded {len(df_events)} event records.")

        req_csv = settings.DATA_DIR / "room_requests.csv"
        if req_csv.exists():
            df_req = pd.read_csv(req_csv)
            # Add missing schema columns if absent
            if "requester_name" not in df_req.columns:
                df_req["requester_name"] = "Anonymous Student"
            if "requester_type" not in df_req.columns:
                df_req["requester_type"] = "student"
            if "accessible_required" not in df_req.columns:
                df_req["accessible_required"] = 0
            if "allocated_room_id" not in df_req.columns:
                df_req["allocated_room_id"] = None
            if "created_at" not in df_req.columns:
                df_req["created_at"] = df_req["request_date"] + " 09:00:00"

            df_req.to_sql("room_requests", conn, if_exists="replace", index=False)
            print(f"[DB] Loaded {len(df_req)} request records.")

        # Create indices for sub-millisecond query performance
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sched_room_day ON class_schedule(room_id, weekday, start_hour);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_events_room_time ON events(room_id, start_time);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_requests_date_status ON room_requests(request_date, status, allocated_room_id);")

    conn.commit()
    conn.close()
    print("[DB] SQLite database initialized successfully.")
