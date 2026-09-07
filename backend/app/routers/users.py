from fastapi import APIRouter, Depends
from app.dependencies.auth import require_staff
from app.database import db
from app.models.user import UserRole

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/search")
async def search_customers(
    search: str,
    limit: int = 20,
    current_user: dict = Depends(require_staff),
):
    """Salon staff (owner/stylist/admin) look up an existing customer by
    name or phone, to book a reservation on their behalf."""
    pattern = {"$regex": search, "$options": "i"}
    query = {"role": UserRole.CUSTOMER.value, "$or": [{"full_name": pattern}, {"phone": pattern}]}
    return await db.users.find(query, {"hashed_password": 0}).to_list(length=limit)
