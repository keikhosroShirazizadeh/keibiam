from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import get_current_active_user, require_owner
from app.database import db
from app.models.service import ServiceCreate, ServiceResponse, ServiceType
from app.utils.transaction_logger import log_transaction
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/services", tags=["Services"])


@router.post("/salon/{salon_id}")
async def create_service(
    salon_id: str,
    service: ServiceCreate,
    current_user: dict = Depends(require_owner)
):
    salon = await db.salons.find_one({"_id": salon_id})
    if not salon or salon["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your salon")

    service_dict = service.model_dump()
    service_dict["_id"] = str(ObjectId())
    service_dict["salon_id"] = salon_id
    service_dict["created_at"] = datetime.utcnow()

    await db.services.insert_one(service_dict)
    log_transaction("create", "services", service_dict["_id"], service_dict, actor_id=str(current_user["_id"]))
    return ServiceResponse(**service_dict)


@router.get("/salon/{salon_id}")
async def get_salon_services(salon_id: str):
    services = await db.services.find({"salon_id": salon_id, "is_active": True}).to_list(length=100)
    return services


@router.put("/{service_id}")
async def update_service(
    service_id: str,
    update_data: dict,
    current_user: dict = Depends(require_owner)
):
    service = await db.services.find_one({"_id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    salon = await db.salons.find_one({"_id": service["salon_id"]})
    if not salon or salon["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.services.update_one({"_id": service_id}, {"$set": update_data})
    log_transaction("update", "services", service_id, update_data, actor_id=str(current_user["_id"]))
    return {"message": "Service updated"}


@router.delete("/{service_id}")
async def delete_service(service_id: str, current_user: dict = Depends(require_owner)):
    service = await db.services.find_one({"_id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    salon = await db.salons.find_one({"_id": service["salon_id"]})
    if not salon or salon["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.services.update_one({"_id": service_id}, {"$set": {"is_active": False}})
    log_transaction("delete", "services", service_id, {"is_active": False}, actor_id=str(current_user["_id"]))
    return {"message": "Service deactivated"}
