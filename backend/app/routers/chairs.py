from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.dependencies.auth import require_owner
from app.database import db
from app.models.chair import ChairCreate, ChairResponse
from app.utils.file_storage import save_image
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


async def _assert_owns_chair(chair: dict, current_user: dict):
    salon = await db.salons.find_one({"_id": chair["salon_id"]})
    if not salon or salon["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")


@router.post("/{chair_id}/image")
async def upload_chair_image(
    chair_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_owner),
):
    chair = await db.chairs.find_one({"_id": chair_id})
    if not chair:
        raise HTTPException(status_code=404, detail="Chair not found")
    await _assert_owns_chair(chair, current_user)

    url = await save_image(file, "chairs")
    await db.chairs.update_one({"_id": chair_id}, {"$set": {"image_url": url}})
    log_transaction("update", "chairs", chair_id, {"image_url": url}, actor_id=str(current_user["_id"]))
    return await db.chairs.find_one({"_id": chair_id})
