from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class SalonStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    REJECTED = "rejected"


class ManagementMode(str, Enum):
    CHAIR_BASED = "chair_based"
    STYLIST_BASED = "stylist_based"


class SalonBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    address: str
    location: dict
    phone: str
    email: Optional[str] = None
    images: List[str] = []
    rating: float = Field(default=0.0, ge=0, le=5)
    review_count: int = 0
    status: SalonStatus = SalonStatus.PENDING
    management_mode: ManagementMode = ManagementMode.CHAIR_BASED
    is_visible: bool = False
    min_booking_interval: int = 15
    max_booking_ahead_days: int = 90


class SalonCreate(SalonBase):
    pass


class SalonInDB(SalonBase):
    id: str = Field(..., alias="_id")
    owner_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SalonResponse(SalonBase):
    id: str
    owner_id: str
    created_at: datetime
