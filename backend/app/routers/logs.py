from datetime import date

from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.dependencies.auth import require_admin
from app.utils.transaction_logger import query_transactions

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.get("/")
async def get_transaction_logs(
    collection: Optional[str] = None,
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    limit: int = Query(200, le=1000),
    current_user: dict = Depends(require_admin),
):
    return {
        "date": date.today().isoformat(),
        "logs": query_transactions(collection=collection, action=action, actor_id=actor_id, limit=limit),
    }
