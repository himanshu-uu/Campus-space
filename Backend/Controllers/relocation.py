import sqlite3
import pandas as pd
from typing import List, Dict, Any
from Backend.Database.db import get_db_connection
from Backend.Controllers.matcher import check_availability

def detect_inefficient_allocations() -> List[Dict[str, Any]]:
    """
    Identifies classes or events assigned to oversized rooms with very low utilization,
    and calculates optimal alternative rooms that could free up large lecture halls.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 1. Inspect class schedule for low occupancy in large rooms
        # (capacity >= 80 and expected_attendance <= capacity * 0.35)
        cur.execute("""
            SELECT 
                cs.schedule_id,
                cs.course_code,
                cs.weekday,
                cs.start_hour,
                cs.duration_hours,
                cs.expected_attendance,
                cs.department,
                r.room_id,
                r.building,
                r.room_type,
                r.capacity,
                r.accessible,
                r.projector,
                r.computers
            FROM class_schedule cs
            JOIN rooms r ON cs.room_id = r.room_id
            WHERE r.capacity >= 80 AND cs.expected_attendance <= (r.capacity * 0.35)
            ORDER BY (r.capacity - cs.expected_attendance) DESC
            LIMIT 40
        """)
        mismatched_classes = cur.fetchall()

        suggestions = []

        for row in mismatched_classes:
            rid = row["room_id"]
            attendance = row["expected_attendance"]
            capacity = row["capacity"]
            wday = row["weekday"]
            start_h = row["start_hour"]
            dur = row["duration_hours"]
            wasted_seats = capacity - attendance
            util_rate = round((attendance / capacity) * 100, 1)

            # Find candidate rooms:
            # - Same building preferred or any building
            # - Capacity >= attendance and <= attendance * 1.6
            # - Free at that weekday & time slot
            cur.execute("""
                SELECT room_id, building, floor, room_type, capacity, projector, computers, accessible
                FROM rooms
                WHERE capacity >= ? AND capacity <= ? AND room_id != ?
                ORDER BY capacity ASC
            """, (attendance, max(attendance + 20, int(attendance * 1.5)), rid))
            candidate_rooms = cur.fetchall()

            valid_alternatives = []
            for cand in candidate_rooms:
                c_id = cand["room_id"]
                # Check if candidate room has class clash at this weekday & time
                cur.execute("""
                    SELECT schedule_id FROM class_schedule
                    WHERE room_id = ? AND weekday = ?
                      AND (start_hour < ?) AND (start_hour + duration_hours > ?)
                    LIMIT 1
                """, (c_id, wday, start_h + dur, start_h))
                has_clash = cur.fetchone()

                if not has_clash:
                    delta = cand["capacity"] - attendance
                    valid_alternatives.append({
                        "room_id": c_id,
                        "building": cand["building"],
                        "floor": cand["floor"],
                        "room_type": cand["room_type"],
                        "capacity": cand["capacity"],
                        "wasted_seats_saved": capacity - cand["capacity"],
                        "fit_description": f"{cand['capacity']} seats ({delta} buffer)"
                    })
                    if len(valid_alternatives) >= 3:
                        break

            if valid_alternatives:
                suggestions.append({
                    "id": row["schedule_id"],
                    "type": "Class Schedule",
                    "title": f"{row['course_code']} ({row['department']})",
                    "time_slot": f"{wday} {start_h:02d}:00 - {start_h + dur:02d}:00",
                    "current_room_id": rid,
                    "current_building": row["building"],
                    "current_capacity": capacity,
                    "attendance": attendance,
                    "wasted_seats": wasted_seats,
                    "utilization_pct": util_rate,
                    "reason": f"Only {attendance} students in a {capacity}-seat {row['room_type']}. Wasting {wasted_seats} seats.",
                    "recommended_rooms": valid_alternatives
                })

        return suggestions

    finally:
        conn.close()

def auto_allocate_pending_requests() -> Dict[str, Any]:
    """
    Evaluates pending or waitlisted room requests and automatically assigns
    the optimal non-conflicting room.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM room_requests
            WHERE status IN ('Waitlisted', 'Pending') AND allocated_room_id IS NULL
            ORDER BY required_capacity DESC
            LIMIT 50
        """)
        pending = cur.fetchall()

        allocated_count = 0
        allocations = []

        for req in pending:
            req_id = req["request_id"]
            req_date = req["request_date"]
            start_h = req["start_hour"]
            dur = req["duration_hours"]
            req_cap = req["required_capacity"]
            proj_req = bool(req["projector_required"])
            comp_req = bool(req["computers_required"])

            # Query eligible rooms
            cur.execute("""
                SELECT * FROM rooms
                WHERE capacity >= ?
                  AND (? = 0 OR projector = 1)
                  AND (? = 0 OR computers = 1)
                ORDER BY capacity ASC
            """, (req_cap, 1 if proj_req else 0, 1 if comp_req else 0))
            candidate_rooms = cur.fetchall()

            for cand in candidate_rooms:
                avail, clash_reason, _ = check_availability(
                    room_id=cand["room_id"],
                    date_str=req_date,
                    start_hour=start_h,
                    duration_hours=dur,
                    conn=conn
                )
                if avail:
                    # Allocate room
                    cur.execute("""
                        UPDATE room_requests
                        SET allocated_room_id = ?, status = 'Approved'
                        WHERE request_id = ?
                    """, (cand["room_id"], req_id))
                    conn.commit()

                    allocations.append({
                        "request_id": req_id,
                        "purpose": req["purpose"],
                        "date": req_date,
                        "time": f"{start_h:02d}:00 - {start_h+dur:02d}:00",
                        "assigned_room": cand["room_id"],
                        "building": cand["building"],
                        "capacity": cand["capacity"],
                        "requested_capacity": req_cap
                    })
                    allocated_count += 1
                    break

        return {
            "evaluated_count": len(pending),
            "allocated_count": allocated_count,
            "allocations": allocations
        }
    finally:
        conn.close()
