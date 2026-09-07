from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, time
from typing import Optional, List, Dict
from enum import Enum


class DayOfWeek(str, Enum):
    SATURDAY = "saturday"
    SUNDAY = "sunday"
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"


class WorkSchedule(BaseModel):
    day: DayOfWeek
    is_working: bool = True
    start_time: time = time(9, 0)
    end_time: time = time(21, 0)
    break_start: Optional[time] = None
    break_end: Optional[time] = None


class StylistBase(BaseModel):
    bio: Optional[str] = None
    specialties: List[str] = []
    images: List[str] = []
    max_booking_ahead_days: int = 90
    is_active: bool = True


class StylistCreate(StylistBase):
    user_id: str
    salon_ids: List[str] = []


class StylistAccountCreate(StylistBase):
    """Owner-facing: creates the stylist's user account and profile together."""
    full_name: str
    email: EmailStr
    phone: str
    national_code: Optional[str] = None
    password: str = Field(..., min_length=6)


class StylistInDB(StylistBase):
    id: str = Field(..., alias="_id")
    user_id: str
    salon_ids: List[str] = []
    work_schedules: List[WorkSchedule] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StylistResponse(StylistBase):
    id: str = Field(..., alias="_id")
    user_id: str
    salon_ids: List[str]
    work_schedules: List[WorkSchedule]

    class Config:
        populate_by_name = True
