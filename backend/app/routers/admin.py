from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies.auth import require_admin
from app.database import db
from app.models.salon import SalonStatus
from app.models.user import UserRole
from app.utils.transaction_logger import log_transaction
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.put("/salons/{salon_id}/status")
async def update_salon_status(
    salon_id: str,
    status: SalonStatus,
    is_visible: bool = False,
    current_user: dict = Depends(require_admin),
):
    salon = await db.salons.find_one({"_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    update_data = {"status": status.value, "is_visible": is_visible, "updated_at": datetime.utcnow()}
    await db.salons.update_one({"_id": salon_id}, {"$set": update_data})
    log_transaction("update", "salons", salon_id, update_data, actor_id=str(current_user["_id"]))
    return {"message": "Salon status updated"}


@router.get("/users")
async def list_users(
    role: UserRole = Query(...),
    search: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(require_admin),
):
    """List users of one role, optionally filtered by a case-insensitive
    substring match against name, phone, or national code."""
    query = {"role": role.value}
    if search:
        pattern = {"$regex": search, "$options": "i"}
        query["$or"] = [{"full_name": pattern}, {"phone": pattern}, {"national_code": pattern}]

    users = await db.users.find(query, {"hashed_password": 0}).to_list(length=limit)
    return users


@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, current_user: dict = Depends(require_admin)):
    """A user's profile plus role-specific detail: a salon_owner's salons
    (any status - the admin needs to see pending/inactive ones too, to
    activate/deactivate them from here), or a stylist's profile with their
    linked salons resolved to names."""
    user = await db.users.find_one({"_id": user_id}, {"hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = {"user": user, "salons": None, "stylist_profile": None}

    if user["role"] == UserRole.SALON_OWNER.value:
        result["salons"] = await db.salons.find({"owner_id": user_id}).to_list(length=100)

    elif user["role"] == UserRole.STYLIST.value:
        stylist = await db.stylists.find_one({"user_id": user_id})
        if stylist:
            salons = await db.salons.find({"_id": {"$in": stylist.get("salon_ids", [])}}).to_list(length=50)
            stylist["salons"] = [{"id": s["_id"], "name": s["name"]} for s in salons]
            result["stylist_profile"] = stylist

    return result
