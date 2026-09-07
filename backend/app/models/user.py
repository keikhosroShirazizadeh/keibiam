from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    SALON_OWNER = "salon_owner"
    STYLIST = "stylist"
    CUSTOMER = "customer"


class UserBase(BaseModel):
    email: EmailStr
    phone: str
    full_name: str
    national_code: Optional[str] = None
    role: UserRole = UserRole.CUSTOMER
    is_active: bool = True
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserSelfUpdate(BaseModel):
    full_name: Optional[str] = None
    national_code: Optional[str] = None


class UserInDB(UserBase):
    id: str = Field(..., alias="_id")
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserResponse(UserBase):
    id: str = Field(..., alias="_id")
    created_at: datetime

    class Config:
        populate_by_name = True
