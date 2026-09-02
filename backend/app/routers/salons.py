from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import require_owner
from app.database import db
from app.models.salon import SalonCreate, SalonResponse, SalonStatus
from app.utils.transaction_logger import log_transaction
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/salons", tags=["Salons"])


@router.post("/")
async def create_salon(salon: SalonCreate, current_user: dict = Depends(require_owner)):
    salon_dict = salon.model_dump()
    salon_dict["_id"] = str(ObjectId())
    salon_dict["owner_id"] = str(current_user["_id"])
    salon_dict["created_at"] = datetime.utcnow()
    salon_dict["updated_at"] = datetime.utcnow()

    await db.salons.insert_one(salon_dict)
    log_transaction("create", "salons", salon_dict["_id"], salon_dict, actor_id=str(current_user["_id"]))
    return SalonResponse(**salon_dict)


@router.get("/")
async def list_salons(status: SalonStatus = None, owner_id: str = None, limit: int = 50):
    query = {}
    if status:
        query["status"] = status.value
    else:
        query["status"] = SalonStatus.ACTIVE.value
        query["is_visible"] = True
    if owner_id:
        query["owner_id"] = owner_id

    salons = await db.salons.find(query).to_list(length=limit)
    return {"salons": salons}


@router.get("/{salon_id}")
async def get_salon(salon_id: str):
    salon = await db.salons.find_one({"_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    return salon


@router.put("/{salon_id}")
async def update_salon(salon_id: str, update_data: dict, current_user: dict = Depends(require_owner)):
    salon = await db.salons.find_one({"_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    if salon["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your salon")

    update_data["updated_at"] = datetime.utcnow()
    await db.salons.update_one({"_id": salon_id}, {"$set": update_data})
    log_transaction("update", "salons", salon_id, update_data, actor_id=str(current_user["_id"]))
    return {"message": "Salon updated"}
