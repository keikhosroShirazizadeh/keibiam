from fastapi import APIRouter, HTTPException, status, UploadFile, File, Depends
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from datetime import datetime, timedelta
from app.database import db
from app.config import settings
from app.dependencies.auth import get_current_active_user
from app.models.user import UserCreate, UserResponse, UserRole, UserSelfUpdate
from app.utils.security import verify_password, get_password_hash
from app.utils.transaction_logger import log_transaction
from app.utils.file_storage import save_image
from bson import ObjectId

router = APIRouter(prefix="/auth", tags=["Authentication"])


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@router.post("/register")
async def register(user: UserCreate):
    existing = await db.users.find_one({"$or": [{"email": user.email}, {"phone": user.phone}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone already registered")

    user_dict = user.model_dump()
    user_dict["hashed_password"] = get_password_hash(user_dict.pop("password"))
    user_dict["_id"] = str(ObjectId())
    user_dict["created_at"] = datetime.utcnow()
    user_dict["updated_at"] = datetime.utcnow()

    await db.users.insert_one(user_dict)
    log_transaction("create", "users", user_dict["_id"], user_dict, actor_id=user_dict["_id"])

    token = create_access_token(
        {"sub": user_dict["_id"], "role": user_dict["role"]},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": token, "token_type": "bearer", "user": UserResponse(**user_dict)}


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account inactive")

    token = create_access_token(
        {"sub": str(user["_id"]), "role": user["role"]},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": token, "token_type": "bearer", "user": UserResponse(**user)}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_active_user)):
    return UserResponse(**current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UserSelfUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.users.update_one({"_id": current_user["_id"]}, {"$set": update_data})
        log_transaction("update", "users", current_user["_id"], update_data, actor_id=str(current_user["_id"]))
    updated = await db.users.find_one({"_id": current_user["_id"]})
    return UserResponse(**updated)


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_active_user),
):
    url = await save_image(file, "avatars")
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"avatar_url": url, "updated_at": datetime.utcnow()}},
    )
    log_transaction("update", "users", current_user["_id"], {"avatar_url": url}, actor_id=str(current_user["_id"]))
    updated = await db.users.find_one({"_id": current_user["_id"]})
    return UserResponse(**updated)
