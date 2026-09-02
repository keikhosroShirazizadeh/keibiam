from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import require_owner
from app.database import db
from app.models.chair import ChairCreate, ChairResponse
from app.utils.transaction_logger import log_transaction
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/chairs", tags=["Chairs"])


@router.post("/salon/{salon_id}")
async def create_chair(salon_id: str, chair: ChairCreate, current_user: dict = Depends(require_owner)):
    salon = await db.salons.find_one({"_id": salon_id})
    if not salon or salon["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your salon")

    chair_dict = chair.model_dump()
    chair_dict["_id"] = str(ObjectId())
    chair_dict["salon_id"] = salon_id
    chair_dict["created_at"] = datetime.utcnow()

    await db.chairs.insert_one(chair_dict)
    log_transaction("create", "chairs", chair_dict["_id"], chair_dict, actor_id=str(current_user["_id"]))
    return ChairResponse(**chair_dict)


@router.get("/salon/{salon_id}")
async def get_salon_chairs(salon_id: str):
    chairs = await db.chairs.find({"salon_id": salon_id, "is_active": True}).to_list(length=100)
    return chairs
