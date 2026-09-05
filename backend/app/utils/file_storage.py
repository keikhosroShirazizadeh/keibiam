import uuid
from pathlib import Path

import aiofiles
from fastapi import HTTPException, UploadFile

from app.config import settings

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

EXTENSION_BY_CONTENT_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


async def save_image(file: UploadFile, subdir: str) -> str:
    """Validate and persist an uploaded image, returning its public /uploads/... URL path."""
    if file.content_type not in EXTENSION_BY_CONTENT_TYPE:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WEBP or GIF images are allowed")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be smaller than 5MB")

    filename = f"{uuid.uuid4().hex}{EXTENSION_BY_CONTENT_TYPE[file.content_type]}"
    target_dir = Path(settings.UPLOAD_DIR) / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    async with aiofiles.open(target_dir / filename, "wb") as f:
        await f.write(contents)

    return f"/uploads/{subdir}/{filename}"
