from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import require_owner
from app.database import db
from app.models.stylist import StylistCreate, StylistAccountCreate, StylistResponse
from app.models.user import UserRole
from app.utils.security import get_password_hash
from app.utils.transaction_logger import log_transaction
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/stylists", tags=["Stylists"])


async def _assert_owns_salon(salon_id: str, current_user: dict):
    salon = await db.salons.find_one({"_id": salon_id})
    if not salon or salon["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your salon")


@router.post("/")
async def create_stylist(stylist: StylistCreate, current_user: dict = Depends(require_owner)):
    """Link an existing stylist-role user to one or more salons."""
    for salon_id in stylist.salon_ids:
        await _assert_owns_salon(salon_id, current_user)

    user = await db.users.find_one({"_id": stylist.user_id})
    if not user or user["role"] != UserRole.STYLIST.value:
        raise HTTPException(status_code=404, detail="No stylist account with that user_id")

    stylist_dict = stylist.model_dump()
    stylist_dict["_id"] = str(ObjectId())
    stylist_dict["work_schedules"] = []
    stylist_dict["created_at"] = datetime.utcnow()

    await db.stylists.insert_one(stylist_dict)
    log_transaction("create", "stylists", stylist_dict["_id"], stylist_dict, actor_id=str(current_user["_id"]))
    return StylistResponse(**stylist_dict)


@router.post("/salon/{salon_id}/create-account")
async def create_stylist_account(
    salon_id: str,
    payload: StylistAccountCreate,
    current_user: dict = Depends(require_owner),
):
    """Owner-facing "add a barber": creates the stylist's login and their
    profile for this salon in one step, since an owner has no way to look
    up an existing stylist's user_id."""
    await _assert_owns_salon(salon_id, current_user)

    existing = await db.users.find_one({"$or": [{"email": payload.email}, {"phone": payload.phone}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone already registered")

    user_dict = {
        "_id": str(ObjectId()),
        "email": payload.email,
        "phone": payload.phone,
        "full_name": payload.full_name,
        "national_code": payload.national_code,
        "role": UserRole.STYLIST.value,
        "is_active": True,
        "avatar_url": None,
        "hashed_password": get_password_hash(payload.password),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.users.insert_one(user_dict)
    log_transaction("create", "users", user_dict["_id"], user_dict, actor_id=str(current_user["_id"]))

    stylist_dict = {
        "_id": str(ObjectId()),
        "user_id": user_dict["_id"],
        "salon_ids": [salon_id],
        "bio": payload.bio,
        "specialties": payload.specialties,
        "images": payload.images,
        "max_booking_ahead_days": payload.max_booking_ahead_days,
        "is_active": True,
        "work_schedules": [],
        "created_at": datetime.utcnow(),
    }
    await db.stylists.insert_one(stylist_dict)
    log_transaction("create", "stylists", stylist_dict["_id"], stylist_dict, actor_id=str(current_user["_id"]))

    return StylistResponse(**stylist_dict)


@router.get("/salon/{salon_id}")
async def get_salon_stylists(salon_id: str):
    stylists = await db.stylists.find({"salon_ids": salon_id, "is_active": True}).to_list(length=100)
    users = await db.users.find({"_id": {"$in": [s["user_id"] for s in stylists]}}).to_list(length=100)
    users_by_id = {u["_id"]: u for u in users}
    for s in stylists:
        user = users_by_id.get(s["user_id"])
        s["full_name"] = user["full_name"] if user else None
        s["email"] = user["email"] if user else None
        s["phone"] = user["phone"] if user else None
    return stylists
