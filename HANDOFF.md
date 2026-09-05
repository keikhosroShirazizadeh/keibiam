# Project Handoff — Salon Booking System

Status snapshot as of 2026-09-05. This document exists to bring a new
contributor (or a future session) up to speed on what exists, what changed
and why, and where to start. The app is runnable end-to-end (register →
create salon → admin approval → create service → owner adds a barber →
customer books → owner confirms), verified live over HTTP.

## What this is

A booking platform for barbershops/salons. Backend: FastAPI + MongoDB
(Motor async driver). Frontend: React + Vite + Tailwind CSS, RTL/Persian
(Farsi) UI. Dockerized via `docker-compose.yml` (mongo + backend + frontend).

The core domain concept: each salon owner chooses one of two **management
modes**:

- **`chair_based`** — customers book a physical chair/station, not a specific
  person.
- **`stylist_based`** — customers book a specific stylist/hairdresser (a
  "barber").

This is modeled by `Salon.management_mode` (`backend/app/models/salon.py`).

## Roles

`super_admin`, `admin`, `salon_owner`, `stylist`, `customer`
(`backend/app/models/user.py`). Role-based access is enforced via FastAPI
dependencies in `backend/app/dependencies/auth.py`
(`require_super_admin`, `require_admin`, `require_owner`, `require_stylist`,
`require_customer`), backed by JWT bearer auth.

There is **no seeded admin account and no promotion flow**. `/auth/register`
does not restrict the `role` field, so a `super_admin` account is created
the same way any other account is — register directly against the API with
`"role": "super_admin"` (the frontend's Register page only offers
customer/salon_owner/stylist, so this has to be done via `curl`/`/docs`).
This is fine for local dev but is a real access-control gap — anyone can
self-register as `super_admin` — worth locking down before this goes
anywhere near production.

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
- `stylists.py` — `POST /stylists/salon/{salon_id}/create-account` (owner;
  creates the barber's login **and** their stylist profile together —
  see history below for why), `POST /stylists/` (link an existing
  stylist-role user to more salons), `GET /stylists/salon/{salon_id}`
  (public; joins in the linked user's name/email/phone)
- `bookings.py` — create (customer; server computes `end_time` and
  `total_price` from the selected services), `GET /bookings/me`,
  `GET /bookings/salon/{salon_id}` (owner), `PUT /bookings/{id}/status`
- `logs.py` — `GET /logs/` (admin-only) — queries today's transaction log,
  filterable by `collection`/`action`/`actor_id`

## Transaction logging (`backend/app/utils/transaction_logger.py`)

Every DB write (create/update/delete) across every router calls
`log_transaction(action, collection, document_id, data, actor_id)`, which
appends one structured JSON line to
`backend/logs/transactions_<YYYY-MM-DD>.jsonl` (password/hash fields are
stripped before writing). One file per day — only today's file is ever
written for now, but `query_transactions()` already accepts a `day`
parameter, so extending retention later is just a matter of keeping older
files around rather than deleting them; no code changes needed. Query it
either by reading the JSONL file directly or via `GET /logs/` (admin JWT
required).

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
  `salons.js`, `bookings.js`, `services.js`, `stylists.js`
- **Pages**: `Home` (salon browse grid), `SalonDetail` (service picker →
  hands off to booking), `BookingPage` (date/time picker), `Login`,
  `Register`, `AdminPanel` (salon approval queue, approve/reject wired to
  the real admin endpoint), `SalonOwnerDashboard` (create salons; real
  "add a barber" form + stylist list on the stylists tab; bookings tab
  still placeholder text), `StylistDashboard` (placeholder)

## Known remaining gaps

Not blockers to running the app, but real gaps to close next:

- **No booking-conflict checking.** `Stylist.work_schedules` and existing
  bookings aren't checked against a new booking's time slot — double
  booking is currently possible.
- **`SalonOwnerDashboard`'s "bookings" tab** is still placeholder text —
  no UI yet for viewing/confirming bookings from the owner side (the
  backend endpoints exist: `bookings.py`'s `GET /bookings/salon/{id}` and
  `PUT /{id}/status` — just not wired into the dashboard UI).
- **`StylistDashboard`** is a placeholder — no schedule management or
  booking view for stylists yet.
- **No chair-based booking UI or chair management UI** — `SalonDetail`/
  `BookingPage` don't yet let a customer pick a chair for a `chair_based`
  salon, and the owner dashboard has no UI to add chairs either (the
  `chair_id` field exists on `Booking` and `chairs.py`'s endpoints exist,
  just unused by the UI).
- **Self-registration as `super_admin`** — see Roles above.
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
#   admin rights / didn't install it as a service:
#   mongod.exe --dbpath ".mongo-data\db" --logpath ".mongo-data\log\mongod.log" --port 27017 --bind_ip 127.0.0.1
#   IMPORTANT: a manually-run mongod like this dies when the terminal that
#   started it closes — it is not a persistent background service unless
#   `Start-Service MongoDB` actually succeeds. If uvicorn hangs on
#   "Waiting for application startup" or throws a confusing socket error
#   on start, check this first: Get-NetTCPConnection -LocalPort 27017

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
containerized) as an alternative to running each piece manually — and
sidesteps the "Mongo isn't a real service" issue entirely, since Docker
manages the mongo container's lifecycle itself.

### Smoke-testing the API directly

```bash
curl -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","phone":"0912...","full_name":"...","password":"secret123","role":"salon_owner"}'
```
Note: `bcrypt` must stay pinned to `4.0.1` in `requirements.txt` — newer
`bcrypt` releases break `passlib==1.7.4`'s hashing backend and make every
register/login call fail with a 500.

## Development history

The project arrived as a scaffold that had never actually run. Work
happened in three rounds, each verified live (not just "it builds") before
moving on.

### Round 1 — get it running at all
Backend wouldn't boot (`main.py` imported five routers that didn't exist
on disk; `auth.py`'s `/me` used an unimported name) and the frontend was
empty folders wired up to dead imports (no `package.json`, no `App.jsx`,
no `store/`, no `api/`). Built the missing routers and the entire frontend
scaffold (routing, zustand auth store, axios client, a `Home`/`SalonDetail`
browse-and-book flow that didn't exist before). While testing the actual
flow end-to-end (not just checking it compiled), found and fixed four bugs
that were invisible from reading the code alone:
- Every `*Response` Pydantic model required an `id` field but every router
  builds dicts keyed by Mongo's `_id` — this crashed **register, login,
  and every create endpoint** with a validation error.
- `create_service` read a `salon_id` field that `ServiceCreate` doesn't
  have — restructured to take `salon_id` from the URL path instead.
- MongoDB/BSON can't store bare `date`/`time` objects, only full
  `datetime` — booking creation crashed on insert.
- The frontend booking form never sends `end_time`, but the model required
  it — made it optional and computed server-side from the selected
  services' total duration (and derived `total_price` the same way, since
  the client never sends that either).
- `bcrypt==5.0.0` (whatever `pip install` resolved to) is incompatible
  with `passlib==1.7.4`'s hashing backend and broke every register call
  with a 500 — pinned `bcrypt==4.0.1`.

Also set up MongoDB locally (installed as a Windows service, but
`Start-Service` needs admin rights we didn't have in-session, so it's run
manually pointed at `.mongo-data/` under the repo — see the caveat above).

Commit: `Make the app actually runnable end-to-end`.

### Round 2 — the actual bug report: barber creation was a no-op
Signing up as a salon owner and trying to add a barber did nothing,
because there was nothing to do it with: the dashboard's "stylists" tab
was placeholder text, and the one endpoint that existed
(`POST /stylists/`) required a stylist's `user_id` — which an owner has
no way to discover, since there was no account-creation path for
stylists at all. Storage itself was never broken; the feature had never
been built.

Fixed by adding `POST /stylists/salon/{salon_id}/create-account`, which
creates the barber's login and their stylist profile in one step, and
building the actual "add a barber" form + list in the owner dashboard.
Also hardened the original link-existing-stylist endpoint to 404 instead
of silently creating an orphaned profile if `user_id` doesn't resolve to a
real stylist account, and made the salon's stylist listing join in the
linked user's name (it previously returned a bare `user_id`).

Also built the transaction-logging system described above, per request,
and wired a `log_transaction()` call into every write in every router.

Commits: `Fix owner barber creation, add queryable transaction logging`.

### Round 3 — WinError 10013 on `uvicorn --reload`
Running `uvicorn app.main:app --reload` directly threw
`[WinError 10013] An attempt was made to access a socket in a way
forbidden by its access permissions`. Investigated port 8000 for
conflicts and Windows-excluded port ranges — neither was the cause.
Reproducing it showed the real problem: **MongoDB had stopped**, because
it's only ever run as a manually-launched background process tied to a
terminal session (see the `Start-Service` caveat above), not a real
persistent service — it dies whenever that session ends. With Mongo down,
`init_db()` hangs and times out on startup, `uvicorn --reload`'s reloader
subprocess is left in a half-bound state on the port, and that surfaced
as the confusing socket permission error rather than a clear "can't reach
MongoDB" message.

Fix was operational, not code: restart `mongod` pointed at `.mongo-data/`,
then start uvicorn normally. No source changes this round. If you hit this
again, check `Get-NetTCPConnection -LocalPort 27017` first — if nothing's
listening, that's the actual problem.
