from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import auth, admin, salons, stylists, chairs, bookings, services

app = FastAPI(
    title="Salon Booking System",
    description="Professional salon management and booking platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(salons.router)
app.include_router(stylists.router)
app.include_router(chairs.router)
app.include_router(bookings.router)
app.include_router(services.router)

@app.on_event("startup")
async def startup():
    await init_db()

@app.get("/")
async def root():
    return {"message": "Salon Booking API", "version": "1.0.0"}
