import sqlite3
import pandas as pd
from typing import Dict, Any, List
from Backend.Database.db import get_db_connection

def compute_utilization_analytics() -> Dict[str, Any]:
    """
    Computes macro-level space utilization, building-level statistics,
    room type breakdowns, and identifies underused spaces.
    """
    conn = get_db_connection()
    try:
        df_rooms = pd.read_sql_query("SELECT * FROM rooms", conn)
        df_sched = pd.read_sql_query("SELECT * FROM class_schedule", conn)
        df_events = pd.read_sql_query("SELECT * FROM events", conn)

        # Operational metrics: 6 days/week (Mon-Sat), 14 hours/day (8am - 10pm) = 84 hours/room/week
        WEEKLY_HOURS_PER_ROOM = 84
        total_rooms = len(df_rooms)
        campus_weekly_capacity_hours = total_rooms * WEEKLY_HOURS_PER_ROOM

        # Class schedule weekly hours
        sched_weekly_hours = df_sched["duration_hours"].sum()
        
        # Estimate average weekly event hours (events spanned across ~17 weeks)
        total_event_hours = df_events["duration_hours"].sum()
        estimated_weekly_event_hours = round(total_event_hours / 17, 1)

        total_booked_weekly_hours = sched_weekly_hours + estimated_weekly_event_hours
        overall_utilization_pct = round(min(100.0, (total_booked_weekly_hours / campus_weekly_capacity_hours) * 100), 2)

        # 1. Utilization by Room Type
        room_type_summary = []
        for r_type, grp in df_rooms.groupby("room_type"):
            r_ids = set(grp["room_id"])
            type_capacity_hours = len(r_ids) * WEEKLY_HOURS_PER_ROOM
            
            # Scheduled hours for this room type
            type_sched_hours = df_sched[df_sched["room_id"].isin(r_ids)]["duration_hours"].sum()
            type_event_hours = round(df_events[df_events["room_id"].isin(r_ids)]["duration_hours"].sum() / 17, 1)
            type_total_hours = type_sched_hours + type_event_hours
            
            rate = round((type_total_hours / type_capacity_hours) * 100, 1) if type_capacity_hours > 0 else 0.0
            
            room_type_summary.append({
                "room_type": r_type,
                "room_count": len(r_ids),
                "total_seats": int(grp["capacity"].sum()),
                "avg_seats": round(float(grp["capacity"].mean()), 1),
                "weekly_booked_hours": round(float(type_total_hours), 1),
                "utilization_pct": rate
            })

        # 2. Utilization by Building
        building_summary = []
        for bldg, grp in df_rooms.groupby("building"):
            r_ids = set(grp["room_id"])
            bldg_cap_hours = len(r_ids) * WEEKLY_HOURS_PER_ROOM
            bldg_sched_hours = df_sched[df_sched["room_id"].isin(r_ids)]["duration_hours"].sum()
            bldg_event_hours = round(df_events[df_events["room_id"].isin(r_ids)]["duration_hours"].sum() / 17, 1)
            bldg_total_hours = bldg_sched_hours + bldg_event_hours
            
            rate = round((bldg_total_hours / bldg_cap_hours) * 100, 1) if bldg_cap_hours > 0 else 0.0
            
            building_summary.append({
                "building": bldg,
                "room_count": len(r_ids),
                "total_seats": int(grp["capacity"].sum()),
                "weekly_booked_hours": round(float(bldg_total_hours), 1),
                "utilization_pct": rate
            })

        # 3. Utilization by Day of Week
        day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        day_sched = df_sched.groupby("weekday")["duration_hours"].sum().to_dict()
        day_summary = []
        for d in day_order:
            hours = day_sched.get(d, 0)
            day_capacity = total_rooms * 14 # 14 hours per room on that day
            day_summary.append({
                "day": d,
                "booked_hours": int(hours),
                "utilization_pct": round((hours / day_capacity) * 100, 1)
            })

        # 4. Underused Space Tracker
        # Dynamic baseline: Rooms in bottom 15% of weekly usage (< 52 hrs) or Friday usage (< 7 hrs)
        room_usage = df_sched.groupby("room_id")["duration_hours"].sum().to_dict()
        friday_usage = df_sched[df_sched["weekday"] == "Fri"].groupby("room_id")["duration_hours"].sum().to_dict()

        underused_rooms = []
        for _, r in df_rooms.iterrows():
            rid = r["room_id"]
            hrs = room_usage.get(rid, 0)
            fri_hrs = friday_usage.get(rid, 0)
            pct = round((hrs / WEEKLY_HOURS_PER_ROOM) * 100, 1)
            fri_pct = round((fri_hrs / 14) * 100, 1)

            # Flag if overall utilization < 60% or Friday < 50%
            if pct < 60.0 or fri_pct < 50.0:
                reasons = []
                if pct < 60.0:
                    reasons.append(f"Low weekly usage ({pct}% - {hrs} hrs/wk)")
                if fri_pct < 50.0:
                    reasons.append(f"Underbooked on Fridays ({fri_pct}% - {fri_hrs} hrs)")

                underused_rooms.append({
                    "room_id": rid,
                    "building": r["building"],
                    "floor": int(r["floor"]),
                    "room_type": r["room_type"],
                    "capacity": int(r["capacity"]),
                    "weekly_hours": int(hrs),
                    "utilization_pct": pct,
                    "friday_utilization_pct": fri_pct,
                    "reason": " & ".join(reasons)
                })

        # Sort underused by lowest utilization first
        underused_rooms.sort(key=lambda x: x["utilization_pct"])

        return {
            "total_rooms": total_rooms,
            "overall_utilization_pct": overall_utilization_pct,
            "total_weekly_booked_hours": int(total_booked_weekly_hours),
            "campus_weekly_capacity_hours": campus_weekly_capacity_hours,
            "by_room_type": room_type_summary,
            "by_building": building_summary,
            "by_day": day_summary,
            "underused_spaces": underused_rooms
        }

    finally:
        conn.close()

def get_demand_forecasting() -> Dict[str, Any]:
    """
    Aggregates room_requests and events to identify peak demand pressure windows,
    busiest days, busiest hours, and purpose distributions.
    """
    conn = get_db_connection()
    try:
        df_req = pd.read_sql_query("SELECT * FROM room_requests", conn)
        df_events = pd.read_sql_query("SELECT * FROM events", conn)

        # 1. Hourly Request Distribution (8 to 22)
        hour_counts = df_req["start_hour"].value_counts().to_dict()
        hourly_demand = []
        for h in range(8, 22):
            count = int(hour_counts.get(h, 0))
            hourly_demand.append({
                "hour": h,
                "label": f"{h:02d}:00",
                "request_count": count,
                "demand_level": "Peak" if count > 450 else ("High" if count > 350 else "Moderate")
            })

        # 2. Demand by Day of Week
        df_req["dt"] = pd.to_datetime(df_req["request_date"])
        df_req["weekday"] = df_req["dt"].dt.day_name().str[:3]
        
        day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        day_req_counts = df_req["weekday"].value_counts().to_dict()
        daily_demand = []
        for d in day_order:
            cnt = int(day_req_counts.get(d, 0))
            daily_demand.append({
                "weekday": d,
                "request_count": cnt
            })

        # 3. Purpose Breakdown
        purpose_counts = df_req["purpose"].value_counts().to_dict()
        purpose_breakdown = [{"purpose": k, "count": int(v)} for k, v in purpose_counts.items()]

        # 4. Status Breakdown (Approval vs Rejection vs Waitlist)
        status_counts = df_req["status"].value_counts().to_dict()
        status_breakdown = [{"status": k, "count": int(v)} for k, v in status_counts.items()]

        # 5. Peak Pressure Windows Detection
        # Group by weekday and start_hour
        pressure_matrix = df_req.groupby(["weekday", "start_hour"]).size().reset_index(name="count")
        top_pressure = pressure_matrix.sort_values(by="count", ascending=False).head(5)
        peak_windows = []
        for _, row in top_pressure.iterrows():
            peak_windows.append(f"{row['weekday']} {int(row['start_hour']):02d}:00 - {int(row['start_hour'])+1:02d}:00 ({row['count']} requests)")

        return {
            "total_requests_analyzed": len(df_req),
            "hourly_demand": hourly_demand,
            "daily_demand": daily_demand,
            "purpose_breakdown": purpose_breakdown,
            "status_breakdown": status_breakdown,
            "peak_windows": peak_windows
        }

    finally:
        conn.close()
