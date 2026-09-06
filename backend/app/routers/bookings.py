from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import get_current_active_user, require_customer, require_owner
from app.database import db
from app.models.booking import BookingCreate, BulkBookingCreate, BookingResponse, BookingStatus
from app.utils.transaction_logger import log_transaction
from bson import ObjectId
from datetime import date as date_type, datetime, timedelta

router = APIRouter(prefix="/bookings", tags=["Bookings"])

CUSTOMER_ALLOWED_STATUSES = {BookingStatus.CANCELLED_BY_CUSTOMER, BookingStatus.CANCEL_REQUESTED}
STAFF_ALLOWED_STATUSES = {
    BookingStatus.CONFIRMED,
    BookingStatus.REJECTED,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED_BY_STYLIST,
}


async def _join_booking_details(bookings: list) -> list:
    """Attach service names/prices and customer name/phone for display."""
    service_ids = {sid for b in bookings for sid in b.get("service_ids", [])}
    customer_ids = {b["customer_id"] for b in bookings}

    services = await db.services.find({"_id": {"$in": list(service_ids)}}).to_list(length=len(service_ids))
    services_by_id = {s["_id"]: s for s in services}

    customers = await db.users.find({"_id": {"$in": list(customer_ids)}}).to_list(length=len(customer_ids))
    customers_by_id = {c["_id"]: c for c in customers}

    for b in bookings:
        b["services"] = [
            {"id": sid, "name": services_by_id[sid]["name"], "price": services_by_id[sid]["price"]}
            for sid in b.get("service_ids", []) if sid in services_by_id
        ]
        customer = customers_by_id.get(b["customer_id"])
        b["customer"] = (
            {"full_name": customer["full_name"], "phone": customer["phone"]} if customer else None
        )
    return bookings


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


@router.post("/bulk")
async def create_bulk_booking(payload: BulkBookingCreate, current_user: dict = Depends(require_customer)):
    """Create one independent pending booking per selected time box, all
    sharing a group_id so the customer's booking list can show which boxes
    belonged to the same request. Each box is accepted/rejected on its own."""
    salon = await db.salons.find_one({"_id": payload.salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    services = await db.services.find({"_id": {"$in": payload.service_ids}}).to_list(length=len(payload.service_ids))
    if len(services) != len(payload.service_ids):
        raise HTTPException(status_code=404, detail="One or more services not found")

    total_price = sum(s["price"] for s in services)
    box_minutes = salon.get("min_booking_interval", 15)
    group_id = str(ObjectId())
    now = datetime.utcnow()
    created = []

    for start_time in payload.start_times:
        start_dt = datetime.combine(payload.booking_date, start_time)
        end_time = (start_dt + timedelta(minutes=box_minutes)).time()

        booking_dict = {
            "_id": str(ObjectId()),
            "salon_id": payload.salon_id,
            "service_ids": payload.service_ids,
            "booking_date": payload.booking_date.isoformat(),
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "status": BookingStatus.PENDING.value,
            "notes": payload.notes,
            "total_price": total_price,
            "group_id": group_id,
            "customer_id": str(current_user["_id"]),
            "stylist_id": payload.stylist_id,
            "chair_id": payload.chair_id,
            "created_at": now,
            "updated_at": now,
        }
        await db.bookings.insert_one(booking_dict)
        log_transaction("create", "bookings", booking_dict["_id"], booking_dict, actor_id=str(current_user["_id"]))
        created.append(booking_dict)

    return {"group_id": group_id, "bookings": created}


@router.get("/me")
async def get_my_bookings(current_user: dict = Depends(get_current_active_user)):
    bookings = await db.bookings.find({"customer_id": str(current_user["_id"])}).to_list(length=100)
    return bookings


@router.get("/salon/{salon_id}/availability")
async def get_salon_availability(salon_id: str, date: date_type):
    """Public: which time boxes are already confirmed-busy on a given day,
    so the customer's day-grid preview can show real (not decorative)
    availability. Only confirmed bookings count as busy - pending requests
    don't block other customers from also requesting the same box, since
    the owner/stylist is the one who decides which of several requests for
    the same slot actually gets confirmed."""
    salon = await db.salons.find_one({"_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    bookings = await db.bookings.find(
        {"salon_id": salon_id, "booking_date": date.isoformat(), "status": BookingStatus.CONFIRMED.value},
        {"start_time": 1},
    ).to_list(length=500)

    return {"busy_times": [b["start_time"] for b in bookings]}


@router.get("/salon/{salon_id}")
async def get_salon_bookings(salon_id: str, current_user: dict = Depends(require_owner)):
    salon = await db.salons.find_one({"_id": salon_id})
    if not salon or salon["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not your salon")

    bookings = await db.bookings.find({"salon_id": salon_id}).to_list(length=200)
    return await _join_booking_details(bookings)


@router.get("/stylist/me")
async def get_my_stylist_bookings(current_user: dict = Depends(get_current_active_user)):
    stylist = await db.stylists.find_one({"user_id": str(current_user["_id"])})
    if not stylist:
        return []

    bookings = await db.bookings.find({"stylist_id": stylist["_id"]}).to_list(length=200)
    return await _join_booking_details(bookings)


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
    is_owner = bool(salon and salon["owner_id"] == str(current_user["_id"]))

    is_stylist = False
    if booking.get("stylist_id"):
        stylist = await db.stylists.find_one({"_id": booking["stylist_id"]})
        is_stylist = bool(stylist and stylist["user_id"] == str(current_user["_id"]))

    if not (is_customer or is_owner or is_stylist):
        raise HTTPException(status_code=403, detail="Not authorized")

    is_staff = is_owner or is_stylist
    if is_staff and new_status not in STAFF_ALLOWED_STATUSES:
        raise HTTPException(status_code=403, detail="Salon staff can only confirm, reject, complete, or cancel a booking")
    if is_customer and not is_staff and new_status not in CUSTOMER_ALLOWED_STATUSES:
        raise HTTPException(status_code=403, detail="Customers can only cancel or request cancellation of their own booking")

    update_data = {"status": new_status.value, "updated_at": datetime.utcnow()}
    await db.bookings.update_one({"_id": booking_id}, {"$set": update_data})
    log_transaction("update", "bookings", booking_id, update_data, actor_id=str(current_user["_id"]))
    return {"message": "Booking status updated"}
