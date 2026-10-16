from datetime import datetime, date
import sqlite3
from typing import Dict, Any, List, Optional, Tuple
from Backend.Database.db import get_db_connection

WEEKDAY_MAP = {
    0: "Mon",
    1: "Tue",
    2: "Wed",
    3: "Thu",
    4: "Fri",
    5: "Sat",
    6: "Sun"
}

def parse_weekday_from_date(date_str: str) -> str:
    """Returns 3-letter weekday abbreviation (Mon, Tue, etc.) from YYYY-MM-DD."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return WEEKDAY_MAP[dt.weekday()]

def check_availability(
    room_id: str,
    date_str: str,
    start_hour: int,
    duration_hours: int,
    conn: Optional[sqlite3.Connection] = None
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Checks class_schedule, events, and confirmed room_requests for any time overlap.
    Returns:
        (is_available: bool, conflict_reason: str or None, conflict_details: dict or None)
    """
    end_hour = start_hour + duration_hours
    weekday = parse_weekday_from_date(date_str)
    
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True

    try:
        cur = conn.cursor()

        # 1. Check Class Schedule for that weekday and room
        # Overlap logic: (class_start < end_hour) AND (class_start + class_duration > start_hour)
        cur.execute("""
            SELECT schedule_id, course_code, start_hour, duration_hours, department
            FROM class_schedule
            WHERE room_id = ? AND weekday = ?
              AND (start_hour < ?) AND (start_hour + duration_hours > ?)
            LIMIT 1
        """, (room_id, weekday, end_hour, start_hour))
        class_conflict = cur.fetchone()

        if class_conflict:
            c_start = class_conflict["start_hour"]
            c_end = c_start + class_conflict["duration_hours"]
            return False, f"Class clash: {class_conflict['course_code']} ({class_conflict['department']}) scheduled from {c_start}:00 to {c_end}:00 on {weekday}s", {
                "source": "class_schedule",
                "id": class_conflict["schedule_id"],
                "title": class_conflict["course_code"],
                "start": c_start,
                "end": c_end
            }

        # 2. Check Events on that specific date
        # start_time is stored as 'YYYY-MM-DD HH:MM:SS'
        date_prefix = f"{date_str}%"
        cur.execute("""
            SELECT event_id, event_type, start_time, duration_hours, expected_attendance
            FROM events
            WHERE room_id = ? AND start_time LIKE ?
        """, (room_id, date_prefix))
        events = cur.fetchall()

        for ev in events:
            # Parse event start hour
            ev_dt = datetime.strptime(ev["start_time"], "%Y-%m-%d %H:%M:%S")
            ev_start = ev_dt.hour
            ev_end = ev_start + ev["duration_hours"]

            # Check overlap
            if (ev_start < end_hour) and (ev_end > start_hour):
                return False, f"Event clash: {ev['event_type']} ({ev['event_id']}) booked from {ev_start:02d}:00 to {ev_end:02d}:00", {
                    "source": "events",
                    "id": ev["event_id"],
                    "title": ev["event_type"],
                    "start": ev_start,
                    "end": ev_end
                }

        # 3. Check approved or active room requests on that date
        cur.execute("""
            SELECT request_id, requester_name, purpose, start_hour, duration_hours
            FROM room_requests
            WHERE allocated_room_id = ? AND request_date = ? AND status IN ('Approved', 'Confirmed')
              AND (start_hour < ?) AND (start_hour + duration_hours > ?)
            LIMIT 1
        """, (room_id, date_str, end_hour, start_hour))
        req_conflict = cur.fetchone()

        if req_conflict:
            r_start = req_conflict["start_hour"]
            r_end = r_start + req_conflict["duration_hours"]
            return False, f"Booking clash: Approved request for '{req_conflict['purpose']}' ({r_start:02d}:00 - {r_end:02d}:00)", {
                "source": "room_requests",
                "id": req_conflict["request_id"],
                "title": req_conflict["purpose"],
                "start": r_start,
                "end": r_end
            }

        return True, None, None

    finally:
        if close_conn:
            conn.close()

def rank_and_score_rooms(
    rooms: List[sqlite3.Row],
    required_capacity: int,
    projector_req: bool,
    computers_req: bool,
    accessible_req: bool
) -> List[Dict[str, Any]]:
    """
    Ranks rooms by optimal capacity fit and feature alignment.
    Scoring formula:
    - Base capacity fitness: 100 - (capacity - required_capacity) * 0.5 (penalizes wasted space)
    - Bonus for having requested facilities
    - Accessibility priority
    """
    scored = []
    for r in rooms:
        cap = r["capacity"]
        delta = cap - required_capacity
        
        # Base fit score: closer to 0 delta is better without being negative
        if delta < 0:
            fit_score = 0
        else:
            # Optimal if cap is 1.0x - 1.3x required
            ratio = cap / max(required_capacity, 1)
            if ratio <= 1.25:
                fit_score = 100 - (ratio - 1.0) * 40
            elif ratio <= 2.0:
                fit_score = 90 - (ratio - 1.25) * 40
            else:
                fit_score = max(20, 60 - (ratio - 2.0) * 15)

        # Amenity satisfaction
        bonus = 0
        if projector_req and r["projector"]:
            bonus += 10
        if computers_req and r["computers"]:
            bonus += 10
        if accessible_req and r["accessible"]:
            bonus += 10
            
        final_score = round(min(100.0, fit_score + bonus), 1)

        # Generate Explainable Badges
        badges = []
        
        # 1. Capacity Fit Badge
        if delta < 0:
            badges.append({
                "category": "Capacity",
                "status": "warning",
                "label": f"Deficit ({cap}/{required_capacity})",
                "detail": f"Room seats {cap}, but {required_capacity} requested."
            })
        elif delta <= 15:
            badges.append({
                "category": "Capacity",
                "status": "optimal",
                "label": f"Perfect Fit ({cap} seats)",
                "detail": f"{cap} seats for {required_capacity} requested (Minimal space waste)"
            })
        elif cap <= required_capacity * 1.8:
            badges.append({
                "category": "Capacity",
                "status": "matched",
                "label": f"Comfortable ({cap} seats)",
                "detail": f"Seats {cap} with {delta} extra seats buffer"
            })
        else:
            badges.append({
                "category": "Capacity",
                "status": "suboptimal",
                "label": f"Oversized ({cap} seats)",
                "detail": f"{delta} unused seats. Consider smaller room if possible."
            })

        # 2. Facilities Badge
        amenities = []
        if r["projector"]: amenities.append("Projector")
        if r["computers"]: amenities.append("Workstations")
        if r["power_outlets"] > 10: amenities.append(f"{r['power_outlets']} Outlets")
        
        amenities_str = ", ".join(amenities) if amenities else "Basic Seating"
        badges.append({
            "category": "Amenities",
            "status": "matched",
            "label": amenities_str,
            "detail": f"Projector: {'✓' if r['projector'] else '✗'} | PCs: {'✓' if r['computers'] else '✗'} | Outlets: {r['power_outlets']}"
        })

        # 3. Accessibility Badge
        if r["accessible"]:
            badges.append({
                "category": "Accessibility",
                "status": "optimal",
                "label": "Wheelchair Accessible",
                "detail": f"Floor {r['floor']} elevator & ramp accessible"
            })
        else:
            badges.append({
                "category": "Accessibility",
                "status": "warning" if accessible_req else "neutral",
                "label": "Standard Access",
                "detail": f"Floor {r['floor']} stairs access only"
            })

        item = dict(r)
        item["score"] = final_score
        item["capacity_delta"] = delta
        item["badges"] = badges
        scored.append(item)

    # Sort descending by score
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored
