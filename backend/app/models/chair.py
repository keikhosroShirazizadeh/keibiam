from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ChairBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    image_url: Optional[str] = None
    service_ids: List[str] = []
    is_active: bool = True


class ChairCreate(ChairBase):
    pass


class ChairInDB(ChairBase):
    id: str = Field(..., alias="_id")
    salon_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChairResponse(ChairBase):
    id: str
    salon_id: str
