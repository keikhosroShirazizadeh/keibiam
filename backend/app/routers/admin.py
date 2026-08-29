from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import require_admin
from app.database import db
from app.models.salon import SalonStatus
from datetime import datetime

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

    await db.salons.update_one(
        {"_id": salon_id},
        {"$set": {"status": status.value, "is_visible": is_visible, "updated_at": datetime.utcnow()}},
    )
    return {"message": "Salon status updated"}
