# Project Handoff — Salon Booking System

Status snapshot as of 2026-08-25. This document exists to bring a new
contributor up to speed on what exists, what's missing, and where to start.

## What this is

A booking platform for barbershops/salons. Backend: FastAPI + MongoDB
(Motor async driver). Frontend: React + Vite + Tailwind CSS, RTL/Persian
(Farsi) UI. Dockerized via `docker-compose.yml` (mongo + backend + frontend).

The core domain concept: each salon owner chooses one of two **management
modes**:

- **`chair_based`** — customers book a physical chair/station, not a specific
  person.
- **`stylist_based`** — customers book a specific stylist/hairdresser.

This is modeled by `Salon.management_mode`
(`backend/app/models/salon.py`).

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

## Backend routes that are actually implemented

- `routers/auth.py` — `POST /auth/register`, `POST /auth/login` (JWT via
  python-jose, bcrypt via passlib), `GET /auth/me`
- `routers/services.py` — create/list-by-salon/update/soft-delete a service,
  scoped to the salon's owner

Everything else referenced by `main.py` (`admin`, `salons`, `stylists`,
`chairs`, `bookings` routers) **does not exist yet** — see Known Gaps below.

## Frontend pages (`frontend/src/pages/`)

- **Login / Register** — Persian UI, role picker on register (customer /
  salon_owner / stylist)
- **BookingPage** — 90-day date grid + 30-min time slot picker, notes field,
  submits a booking
- **SalonOwnerDashboard** — create a salon (choose chair-based vs
  stylist-based), tabs for salons / stylists / bookings (stylists & bookings
  tabs are placeholder text only)
- **AdminPanel** — super-admin salon approval queue with status filters;
  approve/reject buttons are currently stubbed (`alert()`, no real API call)
- **Navbar / Layout** — role-aware navigation

## Known gaps — the project does not currently run

This is an early-stage scaffold, not a working build. Anyone picking this up
should fix these before anything else:

**Backend fails to start:**
- `backend/app/main.py` imports routers `admin`, `salons`, `stylists`,
  `chairs`, `bookings` — none of these files exist under
  `backend/app/routers/` (only `auth.py` and `services.py` do). This is an
  `ImportError` on boot.
- `routers/auth.py`'s `GET /auth/me` uses `get_current_active_user` but
  never imports it → `NameError`.

**Frontend fails to build/run:**
- No `package.json` in `frontend/` at all (the Dockerfile does
  `COPY package.json .`, which will fail). `package-lock.json` present is
  an empty shell.
- `frontend/src/main.jsx` imports `./App`, but no `App.jsx` exists — there
  is no router wiring any page to a URL yet.
- `frontend/src/store/` and `frontend/src/api/` are **empty directories**.
  Pages already reference (but don't yet define):
  - `store/authStore.js` — expected shape based on usage: `isAuthenticated`,
    `user`, `login(token, user)`, `logout()`, `isAdmin()`, `isSalonOwner()`,
    `isStylist()`, `isCustomer()`, `isSuperAdmin()`
  - `api/axiosConfig.js` — axios instance, base URL, auth header injection
  - `api/salons.js` — `salonApi.getAll(params)`, `salonApi.create(data)`
  - `api/bookings.js` — `bookingApi.create(data)`

**Stubbed logic to revisit:**
- Admin approve/reject only shows a JS `alert()`; no backend call wired up
  (there's no admin router to call yet, see above).
- Owner dashboard filters "my salons" client-side by `owner_id` instead of
  using a dedicated endpoint/query param.

## Suggested next steps, in order

1. Add `frontend/package.json` (react, react-dom, react-router-dom, axios,
   zustand, lucide-react, date-fns, tailwind toolchain) and `App.jsx` with
   routing wired to `Layout` + the five existing pages.
2. Implement `store/authStore.js` and the three `api/*.js` files to match
   the interface pages already expect.
3. Fix the missing import in `routers/auth.py`.
4. Implement the missing backend routers — models already exist for all of
   them, so each is mostly CRUD + role checks following the pattern already
   established in `routers/services.py`:
   - `admin.py` — salon approval/rejection, visibility toggle
   - `salons.py` — CRUD + geo search + "my salons" for owners
   - `stylists.py` — CRUD, work schedule management, salon linking
   - `chairs.py` — CRUD scoped to a salon
   - `bookings.py` — create/list/update status, conflict checking against
     `WorkSchedule` and existing bookings
5. Only after the above: revisit the stubbed AdminPanel/owner-dashboard UI
   to call the real endpoints instead of `alert()`.

## Running locally

`docker-compose up` is wired for mongo + backend + frontend, but will not
succeed until the gaps above are closed (missing `package.json`, missing
routers). Until then, treat `docker-compose.yml` as the intended shape of
local dev, not a working command.
