# CampusPulse & SpaceSync — Backend Service

## Overview
CampusPulse & SpaceSync is a high-performance space management and real-time conflict-resolution system for university campuses. Built with **FastAPI**, **SQLite3**, **Pandas**, and **Pydantic**.

---

## Folder Architecture
```
Datathon/
├── Backend/
│   ├── config/
│   │   └── settings.py          # App configuration, base paths, operational hours
│   ├── Controllers/
│   │   ├── schemas.py           # Pydantic request & response validation models
│   │   ├── matcher.py           # Hard constraints, zero-overlap conflict engine & explainable scoring
│   │   ├── timeline.py          # Hourly room availability estimator & campus heat map snapshot
│   │   ├── analytics.py         # Macro space utilization, underused space tracker, demand forecasting
│   │   └── relocation.py       # Inefficient allocation detector & auto-allocation optimizer
│   ├── Database/
│   │   ├── db.py                # SQLite connection manager, table schema creation & CSV seeder
│   │   └── campus_sync.db       # Persistent SQLite database
│   ├── Routes/
│   │   └── api.py               # REST API endpoints
│   ├── data/                    # Source CSVs (rooms, class_schedule, room_requests, events)
│   └── main.py                  # FastAPI application entry point with CORS and lifespan
├── Frontend/                    # Frontend directory
├── requirements.txt             # Python dependencies
└── README.md
```

---

## Features Implemented

### 1. Core Matcher & Zero-Overlap Conflict Engine (`matcher.py`)
- `check_availability(room_id, date, start_hour, duration_hours)`:
  - Validates class schedules (recurrent by weekday).
  - Validates one-off events by timestamp.
  - Validates active/approved student booking requests.
  - Returns `(is_available, conflict_reason, conflict_details)`.
- `rank_and_score_rooms(...)`:
  - Hard filters by capacity, amenities, and accessibility.
  - Calculates smart capacity fit score (penalizing wasted seats).
  - Generates **Explainable Match Badges**:
    - **Capacity Fit**: *Optimal*, *Comfortable*, *Oversized*, or *Deficit*.
    - **Facilities**: Projector, PC workstations, power outlets count.
    - **Accessibility**: Wheelchair accessible / elevator route.
    - **Availability**: 100% Free or Clash details.

### 2. Real-Time Availability Estimator (`timeline.py`)
- Computes hour-by-hour status (08:00 to 22:00) with occupancy breakdown.
- Dynamic natural language status (e.g., *"Available until 14:00, then booked for CS101"*).
- Instant campus-wide overview snapshot for live floorplan / heatmap views.

### 3. Administrator Utilization Dashboard (`analytics.py`)
- Campus-wide utilization percentage.
- Breakdown by **Room Type** (Classroom, Lab, Seminar, Study Room, Auditorium).
- Breakdown by **Building** (North, South, East, West, Central).
- Breakdown by **Day of the Week** (Mon-Sat).
- **Underused Space Tracker**: Flags rooms underbooked across the week (<60%) or on Fridays (<50%) with specific diagnostic reasons.

### 4. Recommendation & Event Relocation Engine (`relocation.py`)
- Scans class schedules for severely mismatched allocations (e.g., small classes of 15-20 students taking up 120-seat lecture halls).
- Recommends non-conflicting smaller rooms to save wasted seats.
- Batch auto-allocation for waitlisted/pending requests.

### 5. Demand Forecasting for Busy Periods (`analytics.py`)
- Analyzes 5,000 requests across hours, weekdays, and purposes.
- Identifies peak demand windows (e.g., *Sun 14:00 - 15:00*, *Tue 11:00 - 12:00*).

---

## Running the Backend

### Prerequisites
- Python 3.10+ installed

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the FastAPI Server
From the project root:
```bash
uvicorn Backend.main:app --reload --port 8000
```

### 3. Interactive API Documentation
Once running, open your browser:
- **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
