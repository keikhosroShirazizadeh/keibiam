from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import require_owner
from app.database import db
from app.models.stylist import StylistCreate, StylistResponse
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/stylists", tags=["Stylists"])


@router.post("/")
async def create_stylist(stylist: StylistCreate, current_user: dict = Depends(require_owner)):
    for salon_id in stylist.salon_ids:
        salon = await db.salons.find_one({"_id": salon_id})
        if not salon or salon["owner_id"] != str(current_user["_id"]):
            raise HTTPException(status_code=403, detail="Not your salon")

    stylist_dict = stylist.model_dump()
    stylist_dict["_id"] = str(ObjectId())
    stylist_dict["work_schedules"] = []
    stylist_dict["created_at"] = datetime.utcnow()

    await db.stylists.insert_one(stylist_dict)
    return StylistResponse(**stylist_dict)


@router.get("/salon/{salon_id}")
async def get_salon_stylists(salon_id: str):
    stylists = await db.stylists.find({"salon_ids": salon_id, "is_active": True}).to_list(length=100)
    return stylists
