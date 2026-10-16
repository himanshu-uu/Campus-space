from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import uuid
import sqlite3

from Backend.Database.db import get_db_connection
from Backend.Controllers.schemas import (
    RoomFilterQuery,
    RoomMatchResult,
    BookingRequestCreate,
    ExplainableMatchBadge
)
from Backend.Controllers.matcher import check_availability, rank_and_score_rooms
from Backend.Controllers.timeline import get_room_timeline, get_building_overview
from Backend.Controllers.analytics import compute_utilization_analytics, get_demand_forecasting
from Backend.Controllers.relocation import detect_inefficient_allocations, auto_allocate_pending_requests

router = APIRouter()

# -------------------------------------------------------------
# 1. CORE MATCHING & CONFLICT ENDPOINT
# -------------------------------------------------------------
@router.post("/rooms/match", response_model=List[RoomMatchResult])
def match_rooms(query: RoomFilterQuery):
    """
    Finds and ranks all rooms matching criteria, checking zero-overlap conflicts
    with class_schedule, events, and confirmed bookings.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # Hard constraint filter
        sql = """
            SELECT room_id, building, floor, room_type, capacity, projector, computers, accessible, power_outlets
            FROM rooms
            WHERE capacity >= ?
        """
        params = [query.required_capacity]

        if query.projector:
            sql += " AND projector = 1"
        if query.computers:
            sql += " AND computers = 1"
        if query.accessible:
            sql += " AND accessible = 1"
        if query.room_type and query.room_type.strip():
            sql += " AND room_type = ?"
            params.append(query.room_type.strip())
        if query.building and query.building.strip():
            sql += " AND building = ?"
            params.append(query.building.strip())

        sql += " ORDER BY capacity ASC"
        cur.execute(sql, params)
        candidate_rooms = cur.fetchall()

        # Score and rank
        ranked_rooms = rank_and_score_rooms(
            rooms=candidate_rooms,
            required_capacity=query.required_capacity,
            projector_req=query.projector,
            computers_req=query.computers,
            accessible_req=query.accessible
        )

        results = []
        for r in ranked_rooms:
            avail, conflict_reason, _ = check_availability(
                room_id=r["room_id"],
                date_str=query.date,
                start_hour=query.start_hour,
                duration_hours=query.duration_hours,
                conn=conn
            )
            
            # Add availability badge
            badges = list(r["badges"])
            if avail:
                badges.insert(0, {
                    "category": "Availability",
                    "status": "optimal",
                    "label": "100% Free",
                    "detail": f"No classes or events scheduled {query.start_hour:02d}:00 - {query.start_hour + query.duration_hours:02d}:00"
                })
            else:
                badges.insert(0, {
                    "category": "Availability",
                    "status": "warning",
                    "label": "Clash Detected",
                    "detail": conflict_reason or "Time slot is currently occupied"
                })

            results.append(RoomMatchResult(
                room_id=r["room_id"],
                building=r["building"],
                floor=r["floor"],
                room_type=r["room_type"],
                capacity=r["capacity"],
                projector=r["projector"],
                computers=r["computers"],
                accessible=r["accessible"],
                power_outlets=r["power_outlets"],
                score=r["score"] if avail else round(r["score"] * 0.2, 1),
                capacity_delta=r["capacity_delta"],
                badges=badges,
                is_available=avail,
                conflict_reason=conflict_reason
            ))

        # Prioritize available rooms first, then by score
        results.sort(key=lambda x: (x.is_available, x.score), reverse=True)
        return results

    finally:
        conn.close()

# -------------------------------------------------------------
# 2. REAL-TIME ROOM TIMELINE ESTIMATOR
# -------------------------------------------------------------
@router.get("/rooms/{room_id}/timeline")
def get_room_schedule(room_id: str, date: str = Query(..., description="Date (YYYY-MM-DD)")):
    """Returns dynamic hourly availability timeline for a specific room."""
    data = get_room_timeline(room_id=room_id, date_str=date)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data

@router.get("/rooms/overview")
def get_campus_overview(date: str = Query(..., description="Date (YYYY-MM-DD)"), hour: int = Query(..., ge=8, le=22)):
    """Returns instant snapshot of all rooms occupancy status at a specific hour."""
    return get_building_overview(date_str=date, hour=hour)

# -------------------------------------------------------------
# 3. ROOM REQUESTS & PERSISTENCE
# -------------------------------------------------------------
@router.post("/requests/submit")
def submit_booking_request(req: BookingRequestCreate):
    """
    Submits a new room request. If room_id is specified, verifies availability
    and automatically approves or rejects with explanation.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        request_id = f"Q{uuid.uuid4().hex[:6].upper()}"

        status = "Pending"
        allocated_room = None
        message = "Request submitted and queued for review."

        if req.room_id:
            avail, conflict_reason, _ = check_availability(
                room_id=req.room_id,
                date_str=req.date,
                start_hour=req.start_hour,
                duration_hours=req.duration_hours,
                conn=conn
            )
            if avail:
                status = "Approved"
                allocated_room = req.room_id
                message = f"Room {req.room_id} successfully reserved for {req.purpose}!"
            else:
                status = "Waitlisted"
                message = f"Room {req.room_id} has a conflict ({conflict_reason}). Placed on waitlist."

        cur.execute("""
            INSERT INTO room_requests (
                request_id, requester_name, requester_type, request_date,
                start_hour, duration_hours, required_capacity,
                projector_required, computers_required, accessible_required,
                purpose, status, allocated_room_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            request_id,
            req.requester_name,
            req.requester_type,
            req.date,
            req.start_hour,
            req.duration_hours,
            req.required_capacity,
            1 if req.projector_required else 0,
            1 if req.computers_required else 0,
            1 if req.accessible_required else 0,
            req.purpose,
            status,
            allocated_room
        ))
        conn.commit()

        return {
            "success": True,
            "request_id": request_id,
            "status": status,
            "allocated_room_id": allocated_room,
            "message": message
        }
    finally:
        conn.close()

@router.get("/requests/recent")
def get_recent_requests(limit: int = 50):
    """Fetches recent room requests."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM room_requests
            ORDER BY rowid DESC
            LIMIT ?
        """, (limit,))
        rows = [dict(r) for r in cur.fetchall()]
        return rows
    finally:
        conn.close()

# -------------------------------------------------------------
# 4. ADMINISTRATOR UTILIZATION DASHBOARD
# -------------------------------------------------------------
@router.get("/admin/analytics")
def get_admin_analytics():
    """Macro space utilization percentages, building breakdowns, and underused spaces."""
    return compute_utilization_analytics()

@router.get("/admin/demand-forecasting")
def get_demand_forecast():
    """Peak pressure windows, busy hours, day-of-week demand distributions."""
    return get_demand_forecasting()

# -------------------------------------------------------------
# 5. RECOMMENDATION & RELOCATION ENGINE
# -------------------------------------------------------------
@router.get("/admin/relocation-suggestions")
def get_relocation_suggestions():
    """Detects inefficient allocations (e.g. 15 students in 120-cap room) and recommends moves."""
    return detect_inefficient_allocations()

@router.post("/admin/auto-allocate")
def trigger_auto_allocation():
    """Batch-evaluates waitlisted or pending requests and fits them into optimal rooms."""
    return auto_allocate_pending_requests()

# -------------------------------------------------------------
# 6. ROOMS METADATA
# -------------------------------------------------------------
@router.get("/rooms/list")
def list_rooms():
    """Returns complete list of rooms with their attributes."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM rooms ORDER BY building, room_id")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()
