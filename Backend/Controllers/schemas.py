from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class RoomFilterQuery(BaseModel):
    date: str = Field(..., description="Date formatted as YYYY-MM-DD", example="2025-09-15")
    start_hour: int = Field(..., ge=0, le=23, description="Starting hour in 24hr format", example=14)
    duration_hours: int = Field(1, ge=1, le=12, description="Duration in hours", example=2)
    required_capacity: int = Field(1, ge=1, description="Minimum room capacity needed", example=30)
    projector: bool = Field(False, description="Require projector")
    computers: bool = Field(False, description="Require computers")
    accessible: bool = Field(False, description="Require wheelchair accessibility")
    room_type: Optional[str] = Field(None, description="Optional room type filter (Classroom, Lab, Seminar, etc.)")
    building: Optional[str] = Field(None, description="Optional building filter")

class ExplainableMatchBadge(BaseModel):
    category: str
    status: str # "optimal", "warning", "matched", "unmatched"
    label: str
    detail: str

class RoomMatchResult(BaseModel):
    room_id: str
    building: str
    floor: int
    room_type: str
    capacity: int
    projector: int
    computers: int
    accessible: int
    power_outlets: int
    score: float
    capacity_delta: int
    badges: List[ExplainableMatchBadge]
    is_available: bool
    conflict_reason: Optional[str] = None

class BookingRequestCreate(BaseModel):
    requester_name: str
    requester_type: str = "student" # student, club, faculty
    room_id: Optional[str] = None
    date: str
    start_hour: int
    duration_hours: int
    required_capacity: int
    projector_required: bool = False
    computers_required: bool = False
    accessible_required: bool = False
    purpose: str

class RelocationSuggestion(BaseModel):
    type: str # 'schedule' or 'event'
    id: str # schedule_id or event_id
    title: str
    current_room_id: str
    current_capacity: int
    attendance: int
    utilization_rate: float
    reason: str
    recommended_rooms: List[Dict[str, Any]]
