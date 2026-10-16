from datetime import datetime
from typing import Dict, Any, List, Optional
import sqlite3
from Backend.Database.db import get_db_connection
from Backend.Controllers.matcher import parse_weekday_from_date

def get_room_timeline(
    room_id: str,
    date_str: str,
    conn: Optional[sqlite3.Connection] = None
) -> Dict[str, Any]:
    """
    Computes hour-by-hour timeline slots (08:00 to 22:00) for a given room and date.
    Returns:
        {
            "room_id": str,
            "date": str,
            "weekday": str,
            "current_status": "Available" | "Occupied",
            "next_free_window": str,
            "timeline": [ { "hour": 8, "status": "Available" | "Occupied", "details": ... }, ... ]
        }
    """
    weekday = parse_weekday_from_date(date_str)
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True

    try:
        cur = conn.cursor()

        # Fetch room metadata
        cur.execute("SELECT * FROM rooms WHERE room_id = ?", (room_id,))
        room = cur.fetchone()
        if not room:
            return {"error": f"Room {room_id} not found"}

        # Fetch regular classes for weekday
        cur.execute("""
            SELECT schedule_id, course_code, start_hour, duration_hours, expected_attendance, department
            FROM class_schedule
            WHERE room_id = ? AND weekday = ?
        """, (room_id, weekday))
        classes = cur.fetchall()

        # Fetch events for date
        date_prefix = f"{date_str}%"
        cur.execute("""
            SELECT event_id, event_type, start_time, duration_hours, expected_attendance
            FROM events
            WHERE room_id = ? AND start_time LIKE ?
        """, (room_id, date_prefix))
        events = cur.fetchall()

        # Fetch approved room requests
        cur.execute("""
            SELECT request_id, requester_name, purpose, start_hour, duration_hours
            FROM room_requests
            WHERE allocated_room_id = ? AND request_date = ? AND status IN ('Approved', 'Confirmed')
        """, (room_id, date_str))
        requests = cur.fetchall()

        # Build hour slots from 8 AM to 22 PM
        slots = {}
        for h in range(8, 22):
            slots[h] = {
                "hour": h,
                "time_label": f"{h:02d}:00 - {h+1:02d}:00",
                "status": "Available",
                "event_type": None,
                "title": None,
                "details": None
            }

        # Overlay classes
        for c in classes:
            c_start = c["start_hour"]
            for h in range(c_start, c_start + c["duration_hours"]):
                if h in slots:
                    slots[h]["status"] = "Occupied"
                    slots[h]["event_type"] = "Class"
                    slots[h]["title"] = f"{c['course_code']} ({c['department']})"
                    slots[h]["details"] = f"Expected students: {c['expected_attendance']}"

        # Overlay events
        for ev in events:
            ev_dt = datetime.strptime(ev["start_time"], "%Y-%m-%d %H:%M:%S")
            ev_start = ev_dt.hour
            for h in range(ev_start, ev_start + ev["duration_hours"]):
                if h in slots:
                    slots[h]["status"] = "Occupied"
                    slots[h]["event_type"] = "Event"
                    slots[h]["title"] = ev["event_type"]
                    slots[h]["details"] = f"Event ID: {ev['event_id']}, Exp: {ev['expected_attendance']}"

        # Overlay approved requests
        for rq in requests:
            r_start = rq["start_hour"]
            for h in range(r_start, r_start + rq["duration_hours"]):
                if h in slots:
                    slots[h]["status"] = "Occupied"
                    slots[h]["event_type"] = "Booking"
                    slots[h]["title"] = rq["purpose"]
                    slots[h]["details"] = f"Booked by: {rq['requester_name']}"

        timeline_list = list(slots.values())
        
        # Summary metrics
        total_hours = len(timeline_list)
        occupied_hours = sum(1 for s in timeline_list if s["status"] == "Occupied")
        utilization_pct = round((occupied_hours / total_hours) * 100, 1)

        # Dynamic availability estimator text
        # If morning (e.g. 9 AM), check first occupancy
        first_occupied = next((s for s in timeline_list if s["status"] == "Occupied"), None)
        if not first_occupied:
            status_text = "Free all day (8:00 AM - 10:00 PM)"
        elif first_occupied["hour"] == 8:
            status_text = f"Occupied starting 8:00 AM for {first_occupied['title']}"
        else:
            status_text = f"Available until {first_occupied['hour']:02d}:00, then booked for {first_occupied['title']}"

        return {
            "room_id": room_id,
            "building": room["building"],
            "floor": room["floor"],
            "room_type": room["room_type"],
            "capacity": room["capacity"],
            "date": date_str,
            "weekday": weekday,
            "status_summary": status_text,
            "utilization_pct": utilization_pct,
            "occupied_hours": occupied_hours,
            "total_operational_hours": total_hours,
            "timeline": timeline_list
        }

    finally:
        if close_conn:
            conn.close()

def get_building_overview(date_str: str, hour: int) -> List[Dict[str, Any]]:
    """
    Returns real-time occupancy status across all rooms for an instant campus heat map.
    """
    weekday = parse_weekday_from_date(date_str)
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT room_id, building, floor, room_type, capacity, accessible FROM rooms ORDER BY building, room_id")
        rooms = cur.fetchall()

        overview = []
        for r in rooms:
            rid = r["room_id"]
            
            # Check class
            cur.execute("""
                SELECT course_code, department FROM class_schedule 
                WHERE room_id = ? AND weekday = ? AND start_hour <= ? AND (start_hour + duration_hours) > ?
            """, (rid, weekday, hour, hour))
            cl = cur.fetchone()

            # Check event
            date_prefix = f"{date_str}%"
            cur.execute("""
                SELECT event_type, start_time, duration_hours FROM events
                WHERE room_id = ? AND start_time LIKE ?
            """, (rid, date_prefix))
            evs = cur.fetchall()
            ev_active = None
            for ev in evs:
                ev_start = datetime.strptime(ev["start_time"], "%Y-%m-%d %H:%M:%S").hour
                if ev_start <= hour < (ev_start + ev["duration_hours"]):
                    ev_active = ev
                    break

            # Check request
            cur.execute("""
                SELECT purpose FROM room_requests
                WHERE allocated_room_id = ? AND request_date = ? AND status IN ('Approved', 'Confirmed')
                  AND start_hour <= ? AND (start_hour + duration_hours) > ?
            """, (rid, date_str, hour, hour))
            rq = cur.fetchone()

            if cl:
                status = "Occupied"
                activity = f"Class: {cl['course_code']} ({cl['department']})"
            elif ev_active:
                status = "Occupied"
                activity = f"Event: {ev_active['event_type']}"
            elif rq:
                status = "Occupied"
                activity = f"Reserved: {rq['purpose']}"
            else:
                status = "Available"
                activity = "Free to book"

            overview.append({
                "room_id": rid,
                "building": r["building"],
                "floor": r["floor"],
                "room_type": r["room_type"],
                "capacity": r["capacity"],
                "status": status,
                "current_activity": activity
            })

        return overview
    finally:
        conn.close()
