# Project Handoff — Salon Booking System

Status snapshot as of 2026-08-29. This document exists to bring a new
contributor up to speed on what exists and where to start. The app is now
runnable end-to-end (register → create salon → admin approval → create
service → book → confirm), verified live over HTTP.

## What this is

A booking platform for barbershops/salons. Backend: FastAPI + MongoDB
(Motor async driver). Frontend: React + Vite + Tailwind CSS, RTL/Persian
(Farsi) UI. Dockerized via `docker-compose.yml` (mongo + backend + frontend).

The core domain concept: each salon owner chooses one of two **management
modes**:

- **`chair_based`** — customers book a physical chair/station, not a specific
  person.
- **`stylist_based`** — customers book a specific stylist/hairdresser.

This is modeled by `Salon.management_mode` (`backend/app/models/salon.py`).

## Roles

`super_admin`, `admin`, `salon_owner`, `stylist`, `customer`
(`backend/app/models/user.py`). Role-based access is enforced via FastAPI
dependencies in `backend/app/dependencies/auth.py`
(`require_super_admin`, `require_admin`, `require_owner`, `require_stylist`,
`require_customer`), backed by JWT bearer auth.

## Data models (`backend/app/models/`)

| Model | Key fields | Notes |
|---|---|---|
| `User` | email, phone, role, is_active, avatar_url | email/phone unique-indexed |
| `Salon` | name, address, geo `location` (2dsphere), status, management_mode, is_visible, booking window config | status workflow: `pending → active/inactive/rejected` |
| `Stylist` | bio, specialties, salon_ids (many-to-many), `WorkSchedule[]` | per-day working hours + optional break window |
| `Chair` | name, service_ids, is_active | belongs to one salon |
| `Service` | type enum (haircut/shave/manicure/pedicure/coloring/treatment/other), duration_minutes, price | belongs to one salon |
| `Booking` | salon_id, service_ids, booking_date, start/end time, status, customer_id, optional stylist_id/chair_id | status workflow: `pending → confirmed/rejected`, `cancel_requested`, `cancelled_by_customer/stylist`, `completed` |

All `*Response` models alias their `id` field to Mongo's `_id` (with
`populate_by_name = True`), so API responses come back with an `_id` key —
that's the convention the frontend expects throughout.

## Backend routes (`backend/app/routers/`)

- `auth.py` — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `salons.py` — create (owner), list (public; `status` filter for
  admin/owner views, defaults to active+visible), get one, update (owner)
- `admin.py` — `PUT /admin/salons/{id}/status` — approve/reject/toggle
  visibility (admin/super_admin)
- `services.py` — `POST /services/salon/{salon_id}` (owner), list by salon
  (public), update/soft-delete (owner)
- `chairs.py` — `POST /chairs/salon/{salon_id}` (owner), list by salon
  (public)
- `stylists.py` — create (owner, linked to salon_ids), list by salon
  (public)
- `bookings.py` — create (customer; server computes `end_time` and
  `total_price` from the selected services), `GET /bookings/me`,
  `GET /bookings/salon/{salon_id}` (owner), `PUT /bookings/{id}/status`

## Frontend (`frontend/src/`)

- `App.jsx` — router; `/`, `/login`, `/register`, `/salon/:salonId`,
  `/salon/:salonId/book`, `/admin`, `/owner-dashboard`,
  `/stylist-dashboard` (last three are role-gated via a `ProtectedRoute`
  wrapper)
- `store/authStore.js` — zustand store, persisted to localStorage:
  `token`, `user`, `isAuthenticated`, `login()`, `logout()`, and
  `isSuperAdmin()/isAdmin()/isSalonOwner()/isStylist()/isCustomer()` role
  checks
- `api/` — `axiosConfig.js` (injects the bearer token, logs out on 401),
  `salons.js`, `bookings.js`, `services.js`
- **Pages**: `Home` (salon browse grid), `SalonDetail` (service picker →
  hands off to booking), `BookingPage` (date/time picker), `Login`,
  `Register`, `AdminPanel` (salon approval queue), `SalonOwnerDashboard`
  (create salons; stylists/bookings tabs still placeholder text),
  `StylistDashboard` (placeholder)

## Known remaining gaps

Not blockers to running the app, but real gaps to close next:

- **No booking-conflict checking.** `Stylist.work_schedules` and existing
  bookings aren't checked against a new booking's time slot — double
  booking is currently possible.
- **`SalonOwnerDashboard`'s "stylists" and "bookings" tabs** are placeholder
  text only; no UI yet for adding stylists/chairs to a salon or viewing/
  confirming bookings from the owner side (the backend endpoints exist:
  `stylists.py`, `chairs.py`, `bookings.py`'s `GET /bookings/salon/{id}`
  and `PUT /{id}/status` — just not wired into the dashboard UI).
- **`StylistDashboard`** is a placeholder — no schedule management or
  booking view for stylists yet.
- **No chair-based booking UI** — `SalonDetail`/`BookingPage` don't yet let
  a customer pick a chair for a `chair_based` salon (the `chair_id` field
  exists on `Booking` and the `chairs.py` endpoints exist, just unused by
  the UI).
- **Owner dashboard's "my salons"** filters client-side by `owner_id`
  rather than a dedicated query — works, but doesn't scale.
- No image upload wired up yet, despite `UploadFile`/`aiofiles` deps and
  `uploads/` directory scaffolding being present.

## Running locally

### Requirements
MongoDB reachable at `mongodb://localhost:27017` (or set `MONGODB_URL` via
a `.env` file in `backend/`), Python 3.11+, Node 20+.

```powershell
# MongoDB (Windows service, needs an elevated PowerShell)
Start-Service MongoDB
# — or run mongod.exe manually with a custom --dbpath if you don't have
#   admin rights / didn't install it as a service.

# Backend
cd backend
dep\Scripts\activate      # or create a fresh venv: python -m venv venv
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000 (interactive docs at /docs)

# Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

`docker-compose up` also works now (mongo + backend + frontend all
containerized) as an alternative to running each piece manually.

### Smoke-testing the API directly

```bash
curl -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","phone":"0912...","full_name":"...","password":"secret123","role":"salon_owner"}'
```
Note: `bcrypt` must stay pinned to `4.0.1` in `requirements.txt` — newer
`bcrypt` releases break `passlib==1.7.4`'s hashing backend and make every
register/login call fail with a 500.
