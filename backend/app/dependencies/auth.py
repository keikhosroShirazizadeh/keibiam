from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import settings
from app.database import db
from app.models.user import UserRole

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"_id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Inactive user")
    return current_user


def require_role(*roles: UserRole):
    async def role_checker(current_user: dict = Depends(get_current_active_user)):
        if current_user["role"] not in [r.value for r in roles]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker


require_super_admin = require_role(UserRole.SUPER_ADMIN)
require_admin = require_role(UserRole.SUPER_ADMIN, UserRole.ADMIN)
require_owner = require_role(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALON_OWNER)
require_stylist = require_role(UserRole.STYLIST)
require_customer = require_role(UserRole.CUSTOMER)
require_staff = require_role(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALON_OWNER, UserRole.STYLIST)
