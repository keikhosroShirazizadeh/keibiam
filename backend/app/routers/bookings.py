from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import get_current_active_user, require_customer, require_owner
from app.database import db
from app.models.booking import BookingCreate, BookingResponse, BookingStatus
from app.utils.transaction_logger import log_transaction
from bson import ObjectId
from datetime import datetime, timedelta

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post("/")
async def create_booking(booking: BookingCreate, current_user: dict = Depends(require_customer)):
    salon = await db.salons.find_one({"_id": booking.salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    services = await db.services.find({"_id": {"$in": booking.service_ids}}).to_list(length=len(booking.service_ids))
    if len(services) != len(booking.service_ids):
        raise HTTPException(status_code=404, detail="One or more services not found")

    total_minutes = sum(s["duration_minutes"] for s in services)
    total_price = sum(s["price"] for s in services)
    start_dt = datetime.combine(booking.booking_date, booking.start_time)
    end_time = (start_dt + timedelta(minutes=total_minutes)).time()

    booking_dict = booking.model_dump()
    booking_dict["_id"] = str(ObjectId())
    booking_dict["customer_id"] = str(current_user["_id"])
    booking_dict["total_price"] = total_price
    booking_dict["created_at"] = datetime.utcnow()
    booking_dict["updated_at"] = datetime.utcnow()
    # MongoDB/BSON has no bare date/time type, only datetime - store as ISO strings.
    booking_dict["booking_date"] = booking_dict["booking_date"].isoformat()
    booking_dict["start_time"] = booking_dict["start_time"].isoformat()
    booking_dict["end_time"] = end_time.isoformat()

    await db.bookings.insert_one(booking_dict)
    log_transaction("create", "bookings", booking_dict["_id"], booking_dict, actor_id=str(current_user["_id"]))
    return BookingResponse(**booking_dict)


@router.get("/me")
async def get_my_bookings(current_user: dict = Depends(get_current_active_user)):
    bookings = await db.bookings.find({"customer_id": str(current_user["_id"])}).to_list(length=100)
    return bookings


@router.get("/salon/{salon_id}")
async def get_salon_bookings(salon_id: str, current_user: dict = Depends(require_owner)):
    salon = await db.salons.find_one({"_id": salon_id})
    if not salon or salon["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your salon")

    bookings = await db.bookings.find({"salon_id": salon_id}).to_list(length=200)
    return bookings


@router.put("/{booking_id}/status")
async def update_booking_status(
    booking_id: str,
    new_status: BookingStatus,
    current_user: dict = Depends(get_current_active_user),
):
    booking = await db.bookings.find_one({"_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_customer = booking["customer_id"] == str(current_user["_id"])
    salon = await db.salons.find_one({"_id": booking["salon_id"]})
    is_owner = salon and salon["owner_id"] == str(current_user["_id"])
    if not is_customer and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {"status": new_status.value, "updated_at": datetime.utcnow()}
    await db.bookings.update_one({"_id": booking_id}, {"$set": update_data})
    log_transaction("update", "bookings", booking_id, update_data, actor_id=str(current_user["_id"]))
    return {"message": "Booking status updated"}
