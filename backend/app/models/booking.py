from pydantic import BaseModel, Field
from datetime import datetime, date, time
from typing import Optional, List
from enum import Enum


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    CANCELLED_BY_CUSTOMER = "cancelled_by_customer"
    CANCELLED_BY_STYLIST = "cancelled_by_stylist"
    CANCEL_REQUESTED = "cancel_requested"
    COMPLETED = "completed"


class BookingBase(BaseModel):
    salon_id: str
    service_ids: List[str]
    booking_date: date
    start_time: time
    end_time: time
    status: BookingStatus = BookingStatus.PENDING
    notes: Optional[str] = None
    total_price: float = 0.0


class BookingCreate(BookingBase):
    stylist_id: Optional[str] = None
    chair_id: Optional[str] = None


class BookingInDB(BookingBase):
    id: str = Field(..., alias="_id")
    customer_id: str
    stylist_id: Optional[str] = None
    chair_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class BookingResponse(BookingBase):
    id: str
    customer_id: str
    stylist_id: Optional[str]
    chair_id: Optional[str]
    created_at: datetime
