from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from enum import Enum


class ServiceType(str, Enum):
    HAIRCUT = "haircut"
    SHAVE = "shave"
    MANICURE = "manicure"
    PEDICURE = "pedicure"
    COLORING = "coloring"
    TREATMENT = "treatment"
    OTHER = "other"


class ServiceBase(BaseModel):
    name: str
    type: ServiceType
    description: Optional[str] = None
    duration_minutes: int = Field(..., ge=15, le=300)
    ingredients: List[str] = []
    price: float = Field(..., ge=0)
    image_url: Optional[str] = None
    is_active: bool = True


class ServiceCreate(ServiceBase):
    pass


class ServiceInDB(ServiceBase):
    id: str = Field(..., alias="_id")
    salon_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ServiceResponse(ServiceBase):
    id: str = Field(..., alias="_id")
    salon_id: str

    class Config:
        populate_by_name = True
