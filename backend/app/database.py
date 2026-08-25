from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client = AsyncIOMotorClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]


async def init_db():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("phone", unique=True)
    await db.salons.create_index("owner_id")
    await db.salons.create_index([("location", "2dsphere")])
    await db.stylists.create_index("user_id")
    await db.stylists.create_index("salon_ids")
    await db.bookings.create_index([("stylist_id", 1), ("date", 1), ("start_time", 1)])
    await db.bookings.create_index("customer_id")
    await db.chairs.create_index("salon_id")
    await db.services.create_index("salon_id")
