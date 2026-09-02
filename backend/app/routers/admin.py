from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import require_admin
from app.database import db
from app.models.salon import SalonStatus
from app.utils.transaction_logger import log_transaction
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

    update_data = {"status": status.value, "is_visible": is_visible, "updated_at": datetime.utcnow()}
    await db.salons.update_one({"_id": salon_id}, {"$set": update_data})
    log_transaction("update", "salons", salon_id, update_data, actor_id=str(current_user["_id"]))
    return {"message": "Salon status updated"}
