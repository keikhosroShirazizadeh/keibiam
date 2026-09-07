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
    end_time: Optional[time] = None
    status: BookingStatus = BookingStatus.PENDING
    notes: Optional[str] = None
    total_price: float = 0.0
    group_id: Optional[str] = None


class BookingCreate(BookingBase):
    stylist_id: Optional[str] = None
    chair_id: Optional[str] = None


class BulkBookingCreate(BaseModel):
    """A customer picks up to 3 time boxes for the same salon/services/date;
    each box becomes its own independent booking that the salon owner or
    assigned stylist can accept or reject on its own. Salon staff (owner/
    stylist) can also call this on behalf of an existing customer by
    passing customer_id - those bookings are auto-confirmed rather than
    left pending, since staff creating one already implies acceptance."""
    salon_id: str
    service_ids: List[str]
    booking_date: date
    start_times: List[time] = Field(..., min_length=1, max_length=3)
    stylist_id: Optional[str] = None
    chair_id: Optional[str] = None
    notes: Optional[str] = None
    customer_id: Optional[str] = None


class BookingInDB(BookingBase):
    id: str = Field(..., alias="_id")
    customer_id: str
    stylist_id: Optional[str] = None
    chair_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class BookingResponse(BookingBase):
    id: str = Field(..., alias="_id")
    customer_id: str
    stylist_id: Optional[str]
    chair_id: Optional[str]
    created_at: datetime

    class Config:
        populate_by_name = True
