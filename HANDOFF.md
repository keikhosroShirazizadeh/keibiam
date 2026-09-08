# Project Handoff — Salon Booking System

Status snapshot as of 2026-09-07. This document exists to bring a new
contributor (or a future session) up to speed on what exists, what changed
and why, and where to start. The app is runnable end-to-end (register →
create salon → admin approval → create service → owner adds a barber →
customer requests multiple time-slot boxes → owner/stylist accepts or
rejects each independently), verified live over HTTP.

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
| `User` | email, phone, full_name, national_code (optional), role, is_active, avatar_url | email/phone unique-indexed; `national_code` is free-text, not validated as a real Iranian national ID, and only used for admin search |
| `Salon` | name, address, geo `location` (2dsphere), status, management_mode, is_visible, booking window config | status workflow: `pending → active/inactive/rejected` |
| `Stylist` | bio, specialties, salon_ids (many-to-many), `WorkSchedule[]` | per-day working hours + optional break window |
| `Chair` | name, service_ids, is_active | belongs to one salon |
| `Service` | type enum (haircut/shave/manicure/pedicure/coloring/treatment/other), duration_minutes, price | belongs to one salon |
| `Booking` | salon_id, service_ids, booking_date, start/end time, status, customer_id, optional stylist_id/chair_id | status workflow: `pending → confirmed/rejected`, `cancel_requested`, `cancelled_by_customer/stylist`, `completed` |

All `*Response` models alias their `id` field to Mongo's `_id` (with
`populate_by_name = True`), so API responses come back with an `_id` key —
that's the convention the frontend expects throughout.

## Backend routes (`backend/app/routers/`)

- `auth.py` — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`,
  `PUT /auth/me` (self-update `full_name`/`national_code` — the only
  fields a user can change about themselves besides their avatar; email/
  phone are left alone since they're login identifiers and unique-indexed)
- `salons.py` — create (owner), list (public; `status` filter for
  admin/owner views, defaults to active+visible), `GET /salons/mine`
  (owner; every salon they own, any status), get one, update (owner),
  `POST /salons/{id}/images` (owner; appends a photo to the gallery)
- `admin.py` — `PUT /admin/salons/{id}/status` — approve/reject/toggle
  visibility (admin/super_admin); `GET /admin/users?role=&search=`
  (admin-only; `role` required, `search` is a case-insensitive substring
  match against full_name/phone/national_code) and
  `GET /admin/users/{user_id}` (admin-only; the user plus role-specific
  detail — `salons` for a salon_owner regardless of status, or
  `stylist_profile` for a stylist with their linked salons resolved to
  names — see Development history Round 9)
- `services.py` — `POST /services/salon/{salon_id}` (owner), list by salon
  (public), update/soft-delete (owner)
- `chairs.py` — `POST /chairs/salon/{salon_id}` (owner), list by salon
  (public), `POST /chairs/{id}/image` (owner; sets/replaces the photo)
- `stylists.py` — `POST /stylists/salon/{salon_id}/create-account` (owner;
  creates the barber's login **and** their stylist profile together —
  see history below for why), `POST /stylists/` (link an existing
  stylist-role user to more salons), `GET /stylists/me` (any user; the
  caller's own stylist profile plus linked salons resolved to id/name —
  404 if they have no stylist profile), `GET /stylists/salon/{salon_id}`
  (public; joins in the linked user's name/email/phone)
- `bookings.py` — `POST /bookings/` (single booking; customer, server
  computes `end_time`/`total_price` from the selected services),
  `POST /bookings/bulk` (up to 3 time boxes; a plain customer books for
  themselves and each box starts `pending` — OR salon staff (the owning
  owner, or a stylist linked to that salon) pass `customer_id` to book on
  behalf of an existing customer, auto-`confirmed` — see Booking model
  below), `GET /bookings/salon/{salon_id}/availability?date=` (public, no
  auth — which boxes are already `confirmed`-busy on a given day;
  `pending` requests don't count as busy, since several customers can
  request the same box and it's up to the owner/stylist which one gets
  confirmed), `GET /bookings/me`, `GET /bookings/salon/{salon_id}`
  (owner; joins in service names and customer name/phone for display),
  `GET /bookings/stylist/me` (any user; empty list if they have no
  stylist profile, otherwise their assigned bookings, same joined shape),
  `PUT /bookings/{id}/status` (customer/owner/assigned stylist — see
  Booking status permissions below)
- `users.py` — `GET /users/search?search=` (staff-only — owner/stylist/
  admin; case-insensitive substring match against a customer's
  full_name/phone) — lets staff find a customer to book on their behalf
- `logs.py` — `GET /logs/` (admin-only) — queries today's transaction log,
  filterable by `collection`/`action`/`actor_id`

## Booking model: slot boxes + independent per-box acceptance

A salon's `min_booking_interval` (already existed on the `Salon` model,
15/30/60 minutes, now settable in the salon creation form) defines the
size of one bookable "box." A customer can select **up to 3** boxes in
one visit to `SalonDetail`; `POST /bookings/bulk` creates one fully
independent `Booking` document per selected box (same `service_ids`,
`total_price`, `stylist_id`/`chair_id`, all sharing one `group_id` so
they're traceable as one customer request), each starting life as
`pending`. There is no merging or "this batch succeeds/fails together"
behavior — the owner or the assigned stylist reviews each box on its own
and can confirm any subset: all of them, some of them, or none. This
directly implements the request: "customer reserves 2 boxes, salon owner
can accept 1, 2, or none of them." (3 was a later, explicit cap — the
model originally allowed up to 10; see Round 10.)

**Staff-initiated bookings** (Round 10): the same `POST /bookings/bulk`
endpoint, called by a salon owner or a stylist linked to that salon, with
`customer_id` set to an existing customer's id (found via
`GET /users/search`). Those boxes are created `confirmed` immediately
rather than `pending` — there's no one else who needs to approve a
booking staff created themselves. A plain customer calling without
`customer_id` behaves exactly as before (books for themselves, `pending`).

Each box's `end_time` is `start_time + min_booking_interval` — **not**
the sum of the selected services' `duration_minutes`. A service longer
than one box currently just gets attached to a single box-length booking;
there's no enforcement that a customer picks enough contiguous boxes to
cover a long service's real duration. That's a conscious v1 simplification,
not an oversight — flagged again under Known gaps.

### Booking status permissions (`PUT /bookings/{id}/status`)

Three actors can touch a booking's status, each restricted to different
transitions:
- **Customer** (`booking.customer_id` matches): only
  `cancelled_by_customer` or `cancel_requested`.
- **Salon owner** (owns the salon the booking belongs to) or **assigned
  stylist** (`booking.stylist_id` resolves to a `Stylist` whose `user_id`
  matches): `confirmed`, `rejected`, `completed`, `cancelled_by_stylist`.
  The stylist match requires a DB lookup since `booking.stylist_id` is a
  `Stylist` document id, not a `User` id.
- Anyone else: 403.

This didn't exist before this round — the old endpoint let the customer
*or* the owner set literally any status with no transition restriction,
and didn't let a stylist touch bookings at all (only the owner could).

## File uploads (`backend/app/utils/file_storage.py`)

`save_image(file, subdir)` validates content-type (JPEG/PNG/WEBP/GIF only)
and size (5MB cap), writes the file under `backend/uploads/<subdir>/` with
a generated filename, and returns a `/uploads/<subdir>/<file>` URL path.
`main.py` mounts `backend/uploads/` as static files at `/uploads`, so that
path is directly fetchable from the backend host. Three endpoints use it:
`POST /auth/me/avatar` (any user, their own profile picture),
`POST /salons/{id}/images` (owner, appends to the salon's photo gallery),
`POST /chairs/{id}/image` (owner, sets a chair's photo). The frontend's
`fileUrl()` helper (`api/axiosConfig.js`) prefixes these relative paths
with the backend's base URL, since the frontend is served from a
different origin/port than the backend.

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
  `/admin`, `/owner-dashboard`, `/stylist-dashboard`, `/profile` (last
  four are role-gated — `/profile` just requires being logged in, any
  role — via a `ProtectedRoute` wrapper). There is no separate booking
  route any more — see Round 9.
- `store/authStore.js` — zustand store, persisted to localStorage:
  `token`, `user`, `isAuthenticated`, `login()`, `logout()`, `setUser()`
  (used after an avatar upload or profile edit to refresh the stored user
  without a full re-login), and `isSuperAdmin()/isAdmin()/isSalonOwner()/
  isStylist()/isCustomer()` role checks
- `api/` — `axiosConfig.js` (injects the bearer token, logs out on 401,
  exports `fileUrl()` to resolve `/uploads/...` paths against the backend
  origin), `salons.js`, `bookings.js` (`createBulk()` takes an optional
  `customer_id` for staff bookings), `services.js`, `stylists.js`
  (`getMe()` new in Round 10), `chairs.js`, `profile.js` (`update()` for
  self-update, `uploadAvatar()`), `admin.js` (`listUsers(role, search)`,
  `getUserDetail(userId)`), `users.js` (`searchCustomers(search)`, new in
  Round 10 — staff-only customer lookup)
- `utils/jalali.js` (Round 10) — wraps the `jalaali-js` package (note:
  import its named exports, e.g. `import { toJalaali } from 'jalaali-js'`
  — it has no default export, which fails silently under Node's CommonJS
  `require()` interop but breaks the Vite/Rollup build outright; caught
  this at build time, not runtime). `formatJalali(date)` converts a
  Gregorian JS `Date` to `{ weekday, day, month, year }` Persian-language
  display labels — purely cosmetic. The `Date` object and any ISO string
  built from it (e.g. via `date-fns`'s `format(date, 'yyyy-MM-dd')`)
  remain Gregorian throughout — that's what the backend stores and
  expects; only the on-screen labels are Jalali.
- `components/PersianDatePicker.jsx` (Round 10) — the next 90 days as a
  button grid, Jalali-labeled via `utils/jalali.js`, Gregorian
  `yyyy-MM-dd` as the actual selection value. Used by `SalonDetail` and
  `BookForCustomerForm`.
- `components/DayBoxGrid.jsx` — renders one day (08:00–24:00, hardcoded
  range) divided into `boxMinutes`-sized boxes, multi-select, busy boxes
  struck through and unselectable. Exports `buildDayBoxes(boxMinutes)`
  too. Used by `SalonDetail` and `BookForCustomerForm`.
- `components/SalonForm.jsx` — the salon field set (name/address/phone/
  management_mode/min_booking_interval/description/map location), shared
  by `SalonOwnerDashboard`'s create-salon form and its per-card edit form
  so the two can't drift out of sync.
- `components/LocationPicker.jsx` — `react-leaflet` + OpenStreetMap tiles
  (no API key needed), click-to-place-marker map; used inside `SalonForm`
- `components/BookingList.jsx` — shared by `SalonOwnerDashboard`'s
  "bookings" tab and `StylistDashboard`: renders a booking's date/time/
  services/customer/price/status and the status-appropriate action
  buttons (pending → confirm/reject, confirmed → complete/cancel,
  cancel_requested → confirm the cancellation), calling back with
  `onStatusChange(bookingId, newStatus)`
- `components/BookForCustomerForm.jsx` (Round 10) — the staff-booking
  form: debounced customer search (`GET /users/search`) → service
  checkboxes → optional chair/stylist pick (skipped entirely when a
  `fixedStylistId` prop is given, i.e. a stylist booking for their own
  slot) → `PersianDatePicker` → `DayBoxGrid` (max 3 boxes) → notes →
  submit via `bookingApi.createBulk` with `customer_id` set. Embedded as
  a toggleable section in `SalonOwnerDashboard`'s bookings tab and in
  `StylistDashboard`, not a standalone page.
- **Pages**: `Home` (salon browse grid), `SalonDetail` (everything a
  customer needs to book, on one page: service checkboxes, optional
  chair/stylist pick per the salon's management mode, `PersianDatePicker`,
  an interactive `DayBoxGrid` (max 3 boxes) sized by `min_booking_interval`
  with real busy boxes disabled — refetches `GET .../availability`
  whenever the date changes — notes, submit via `POST /bookings/bulk`;
  see Round 9 for why this used to be two pages), `Login`, `Register`
  (now also collects an optional `national_code`), `Profile` (avatar
  upload plus an editable full_name/national_code form, via
  `PUT /auth/me`), `AdminPanel` (two top-level tabs: "آرایشگاه‌ها" — the
  original salon approval queue, unchanged — and "کاربران", from Round 9:
  role tabs salon_owner/stylist/customer, a debounced name/phone/
  national_code search, and a detail panel that shows a salon_owner's
  salons with activate/deactivate wired to the same admin endpoint, or a
  stylist's bio/specialties/linked salons), `SalonOwnerDashboard` (create
  salons via `SalonForm`; each card's "ویرایش" button opens that same
  form inline, pre-filled, submitting to `PUT /salons/{id}` — the
  strategy, including `min_booking_interval`, is editable after
  creation; photo gallery with upload button; real "add a barber" form
  (now also collects `national_code`) + stylist list on the stylists
  tab; "Chairs" tab; "bookings" tab has a real `BookingList` per salon
  plus, new in Round 10, a "رزرو برای مشتری" button that opens
  `BookForCustomerForm`), `StylistDashboard` (a real `BookingList` of
  bookings assigned to that stylist via `GET /bookings/stylist/me`; now
  also fetches the stylist's own profile via `GET /stylists/me` to offer
  a salon picker (if linked to more than one) and the same
  "رزرو برای مشتری" flow, with `fixedStylistId` set to themselves)

## Known remaining gaps

Not blockers to running the app, but real gaps to close next:

- **No booking-conflict checking.** `Stylist.work_schedules` and existing
  bookings aren't checked against a new booking's time slot — a customer
  (or several different customers) can request the same box repeatedly;
  nothing stops the owner from confirming overlapping bookings either
  (the `availability` endpoint only hides *already-confirmed* boxes from
  the customer's grid — it doesn't stop the owner from confirming a
  second booking into an already-busy one server-side). This is sharper
  since Round 10: a staff-created booking (`customer_id` set) is
  auto-`confirmed` with **no availability check at all** — an owner could
  double-book a box that's already confirmed for someone else with
  nothing stopping them.
- **Box length vs. service duration isn't reconciled.** Each booking box
  always lasts exactly `min_booking_interval` regardless of the selected
  services' actual total duration — see Booking model above.
- **The day-grid's 08:00–24:00 range and business hours generally are
  hardcoded** — `DayBoxGrid.jsx`'s `DAY_START_HOUR`/`DAY_END_HOUR`
  constants, not a per-salon setting. A salon that's actually only open
  10–18 still shows the full 08:00–24:00 grid.
- **No chair-based booking *conflict* UI for customers** — chair
  *management* exists (owner dashboard's "Chairs" tab), and `SalonDetail`
  lets a customer optionally pick a chair/stylist, but availability is
  tracked per salon+date only, not per chair or per stylist — two
  customers could each get a box confirmed for the same time at the same
  salon on different chairs and neither would see the other as busy.
- **`StylistDashboard`** still has no working-schedule management (only a
  booking list now).
- **Self-registration as `super_admin`** — see Roles above.
- **No edit/delete for salon photos or chairs** — you can add a photo to a
  salon's gallery or set a chair's photo, but there's no UI (or endpoint)
  to remove one. Editing the salon's own fields (name/address/strategy/
  location) now works; photos are still append-only.
- **`national_code` is unvalidated free text**, not checked against the
  real Iranian national-ID checksum algorithm, and not required at
  registration — added purely as an admin search field per Round 9's
  request. Two different users could enter the same value, or nonsense.
- **Customer profile view in the admin panel is bare-bones** — name,
  email, phone, national code, active status. No booking history, no way
  to deactivate a customer account (only salons have an activate/
  deactivate action right now).

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

### Round 4 — "cannot register barber", again: CORS, and a process pileup
Reported again after Round 2's fix had already landed, so the feature
itself wasn't the suspect this time. The backend log showed the real
failure: `OPTIONS /auth/register` preflight requests were getting
**400 Bad Request** from Starlette's CORS middleware. `main.py`'s
`allow_origins` only listed `http://localhost:5173` and
`http://localhost:3000` — if the browser was pointed at
`http://127.0.0.1:5173` instead of `localhost:5173` (same server, but a
different origin as far as CORS enforcement cares), every non-trivial
request got rejected at the preflight, before the actual endpoint logic
ever ran. Fixed by adding the `127.0.0.1` equivalents to `allow_origins`.

While diagnosing, found the actual environment was worse than expected:
**three separate `uvicorn` processes** were all bound to port 8000 at
once (one under the project's venv, others under a system-wide Python
install — left over from earlier sessions' `uvicorn --reload` runs never
being cleanly stopped), and **two separate `vite` processes** on 5173
and 5174. Whichever process actually wins the socket bind on Windows is
unpredictable, so it's entirely possible to be editing/testing against
one instance while the browser or curl talks to a stale one running
different code (or, worse, a different Python environment without the
`bcrypt` pin from Round 1). `uvicorn --reload`'s Windows behavior makes
this worse: reload spawns a new worker as a `multiprocessing` child
process, and killing the parent reloader does **not** kill that child —
it's left orphaned, still holding the port, invisible to a process
search for `*uvicorn*` in its command line.

If you hit connection weirdness that doesn't make sense (wrong CORS
behavior, stale responses, "it worked a second ago"), check for exactly
this before debugging application code:
```powershell
Get-NetTCPConnection -LocalPort 8000,5173 -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Select ProcessId,CommandLine
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select ProcessId,CommandLine
```
Kill everything matching, confirm the ports are free, then start exactly
one instance of each. Running the backend without `--reload` during
manual testing avoids the orphaned-worker failure mode entirely, at the
cost of restarting manually after edits.

Commit: `Allow 127.0.0.1 origins in CORS alongside localhost`.

### Round 5 — owner's own salons invisible in their dashboard
Reported: a salon owner's created salons weren't showing up in their own
dashboard. Root cause: `GET /salons/` (the public listing endpoint) always
defaults to `status=active AND is_visible=true` whenever no `status` param
is passed — and a newly-created salon starts as `status=pending,
is_visible=false`. The dashboard called this public endpoint with no
status filter and then filtered the result by `owner_id` client-side, but
the server had already excluded the salon *before* that filter ever ran,
so it was invisible to its own owner with no way to even check on its
pending status.

Fixed by adding `GET /salons/mine` (owner-authenticated), returning every
salon the current user owns regardless of status, and pointing the
dashboard at it instead of the public-listing-plus-client-filter hack.

Commit: `Fix owner dashboard never showing the owner's own salons`.

### Round 6 — profile pictures, salon photo galleries, map location, chair photos
Requested feature set: avatar upload for any user, photo galleries for
salons, a map picker for a salon's location (previously hardcoded to
Tehran on creation), and photos for chairs. The last one required first
building chair *management* itself, since there was no UI for chairs at
all before this — you can't attach a photo to something with no
creation UI.

Built:
- `app/utils/file_storage.py` — validates (JPEG/PNG/WEBP/GIF, 5MB cap)
  and persists an uploaded image under `backend/uploads/<subdir>/`,
  returning a `/uploads/<subdir>/<file>` URL. `main.py` mounts that
  directory as static files. This is also what the original scaffold's
  unused `aiofiles`/`UploadFile` imports in `auth.py` were clearly meant
  for and never got — now they're actually exercised.
- Three upload endpoints: `POST /auth/me/avatar`, `POST
  /salons/{id}/images` (`$push`, so a gallery builds up over multiple
  uploads), `POST /chairs/{id}/image`.
- `LocationPicker.jsx` (`react-leaflet` + OpenStreetMap tiles, no API key
  needed) — click-to-place-marker map, replacing the hardcoded Tehran
  coordinates in the salon creation form.
- A `Profile` page (`/profile`, any logged-in user) for avatar upload;
  Navbar now shows the user's avatar.
- Owner dashboard: photo gallery + upload button on each salon card; new
  "Chairs" tab (mirrors the existing "Stylists" tab pattern) — salon
  selector, create-chair form, per-chair photo upload. The salon card's
  "مدیریت صندلی‌ها" (manage chairs) button, dead since Round 1, now jumps
  to this tab with that salon pre-selected.

Verified live end-to-end via curl with multipart uploads (a generated
test JPEG): avatar upload, salon creation with non-default coordinates,
salon photo upload, chair creation, chair photo upload, fetching an
uploaded file back from `/uploads/...` with the correct content-type,
and a non-image file correctly rejected with 400.

Commit: `Add profile pictures, salon photo galleries, map location
picker, chair photos`.

### Round 7 — customers couldn't book; slot-box reservation model
Reported: "customer cannot make reservations," plus a request for salon
owners to define a reservation strategy — configurable time-box size
(15/30/60 min), customer selects multiple boxes, owner or hairdresser
accepts any subset.

Investigation first: called `POST /bookings/` directly with the exact
payload shape `BookingPage.jsx` built (including `stylist_id`/`chair_id`
omitted the way JS `undefined` values get dropped by `JSON.stringify`) —
it succeeded. So the raw create-booking API was never broken. The real
problem was the booking UI itself: `SalonDetail.jsx`'s "continue to
booking" never set `stylistId`/`chairId` in the router state it handed
to `BookingPage` — there was no UI to pick either — so those fields were
always `undefined`, and `BookingPage` depended on fragile
`useLocation().state` rather than fetching the salon itself. Functionally
bookable, but with an incomplete, confusing flow — which is what
"customer cannot make reservations" was describing.

Rebuilt around the slot-box model (confirmed the design with the user
first: each selected box is an independent request, not a merged span —
see Booking model above):
- `Salon.min_booking_interval` (already existed, unused) is now settable
  in the salon creation form.
- New `POST /bookings/bulk` + `BulkBookingCreate` model: one call, N
  independent `pending` bookings, one per selected box, sharing a
  `group_id`.
- `PUT /bookings/{id}/status` reworked: added stylist authorization
  (resolves `booking.stylist_id` → `Stylist.user_id`, previously only the
  owner could act), and restricted which status each role can set
  (customer: cancel only; owner/stylist: confirm/reject/complete/cancel)
  — previously either party could set *any* status with no restriction.
- `GET /bookings/salon/{id}` and the new `GET /bookings/stylist/me` now
  join in service names and customer name/phone, since a booking only
  ever stored `service_ids`/`customer_id`.
- `BookingPage.jsx` rewritten: fetches the salon directly (no longer
  relies solely on router state), renders a multi-select box grid sized
  by the salon's interval, lets the customer optionally pick a chair or
  stylist depending on the salon's `management_mode`, submits via the
  bulk endpoint.
- New shared `BookingList.jsx` component, used to build out two
  previously-placeholder screens: `SalonOwnerDashboard`'s "bookings" tab
  and `StylistDashboard` (which had literally nothing but a welcome
  message before).

Verified live end-to-end with throwaway accounts against the real dev
database (cleaned up after): customer requested 2 boxes for a
stylist-based salon → owner's salon view showed both with joined service/
customer info → owner confirmed one and rejected the other → customer's
own `/bookings/me` correctly showed one `confirmed` and one `rejected` →
the assigned stylist's `/bookings/stylist/me` showed the same and could
independently confirm a third booking → verified a customer cannot
self-confirm (403), a stranger cannot touch someone else's booking (403),
and a customer can cancel their own confirmed booking (200).

Commit: `Add slot-box booking model with independent per-box accept/
reject`.

### Round 8 — day-grid preview on the salon page, editable time strategy
Requested: when a customer clicks into a salon they should immediately
see the whole day (08:00–midnight) divided into boxes; and the owner
should be able to edit a salon's booking-interval strategy after
creation, not just set it once at creation time.

- New public `GET /bookings/salon/{id}/availability?date=` returns which
  boxes are already `confirmed`-busy for a day. Deliberately excludes
  `pending` bookings from "busy" — several customers can request the same
  box, and it's the owner/stylist's call which one gets confirmed, so
  marking a pending request as "busy" would incorrectly block other
  customers from even trying.
- Extracted `components/DayBoxGrid.jsx` (used to be inline in
  `BookingPage`) with a read-only mode (no `onToggle`) for `SalonDetail`'s
  new "برنامه امروز" (today's schedule) section, and kept the interactive
  multi-select mode for `BookingPage`, which now also disables busy boxes
  and refetches availability whenever the selected date changes. Range
  extended from the old hardcoded 9–21 to 8–24 per the request.
- `PUT /salons/{id}` already existed and already accepted any field, so
  no backend change was needed for editing — only that the frontend never
  used it for anything but admin status changes. Extracted the salon
  field set into `components/SalonForm.jsx` (shared by create and edit,
  so they can't drift out of sync); the salon card's "ویرایش" button
  (dead since Round 1) now opens that form inline, pre-filled from the
  salon's current data including `min_booking_interval`.
- Collateral fix: `SalonOwnerDashboard.jsx` had a stray `w-120` Tailwind
  class (not a real utility - the config has no custom spacing past the
  default `w-96`) on the salon photo thumbnails, flagged but left alone
  in the last two rounds since it was outside what was asked each time.
  This round's edit rewrote that exact block anyway, so fixed it back to
  `w-16 h-16` rather than leave known-broken CSS in code already being
  rewritten.

Verified live against the real dev database with throwaway accounts
(cleaned up after): availability endpoint returns empty before any
booking exists; a bulk request's `pending` boxes correctly don't appear
as busy; confirming one of them makes exactly that box (and only that
box) show up in `busy_times`; edited a salon's name and interval via
`PUT /salons/{id}` and confirmed both took effect on refetch.

Commit: `Add day-grid availability preview and salon editing`.

### Round 9 — booking still unclickable; admin user browser by role
Reported again: "customer cannot clicked on a specific time to make
reservation." Diagnosis this time: Round 8 had built two separate grids —
a **read-only** preview on `SalonDetail` (the first thing a customer
sees when they open a salon) and a **separate interactive** grid on
`BookingPage`, reachable only after checking services and clicking
"continue." A customer naturally tries clicking the first grid they see
— which, by design, did nothing. That's on this project, not a
misunderstanding: splitting one action across two pages/grids, only one
of which worked, was the bug. Fixed by merging `BookingPage`'s entire
flow (chair/stylist pick, date picker, notes, submit) into `SalonDetail`
itself, so the only grid a customer ever sees is the one they can act
on. `BookingPage.jsx` and its route are gone; `DayBoxGrid` lost its
now-unreachable read-only mode along with them (was never used from
anywhere else).

Also requested: an admin panel to browse users by role (salon owner /
stylist / customer) with search by phone, national code, or name, and
click-through to a role-specific detail — a salon owner's salons
(with activate/deactivate), a stylist's profile, a customer's profile.
`national_code` didn't exist anywhere in the schema before this — added
to `User` (optional, unvalidated free text — see Known gaps), exposed in
`Register` and the owner's "add a barber" form, and made editable after
the fact via a new `PUT /auth/me` (previously there was no way for a
user to change anything about their own profile except the avatar).

Backend: `GET /admin/users?role=&search=` (role required, `search` a
case-insensitive substring match across full_name/phone/national_code)
and `GET /admin/users/{user_id}` (the user, plus — depending on role —
every salon they own regardless of status, or their stylist profile with
linked salon ids resolved to names).

Frontend: `AdminPanel` restructured into two top-level tabs — the
original salon-approval table (unchanged, renamed "آرایشگاه‌ها") and a
new "کاربران" tab with role tabs, a debounced search box, a result list,
and a detail panel. Activating/deactivating a salon from inside the
owner's detail view calls the exact same endpoint as the original salon
table (factored the status-badge and action-buttons markup into two tiny
local components, `SalonStatusBadge`/`SalonStatusActions`, used in both
places so they can't drift apart).

Verified live against the real dev database with throwaway accounts
(cleaned up after): searched by name, by phone-number substring, and by
national_code, each returning the right single match; opened a salon
owner's detail and saw their salon in `pending`, activated it from that
exact view, and confirmed the change stuck on refetch; opened a
stylist's detail and saw bio/specialties/linked salon name resolved
correctly; opened a customer's detail and saw their basic profile; ran
the merged `SalonDetail` booking flow end-to-end with the exact payload
the new single-page UI builds.

Commit: `Merge booking flow into SalonDetail; add admin user browser`.

### Round 10 — Persian calendar, 3-box cap, staff booking on behalf of a customer, and the actual 403 bug
Four asks in one message: (1) show the calendar in Persian/Jalali to all
users, (2) cap box selection at 1–3 instead of the prior unlimited-up-to-
10, (3) let a salon owner or stylist create a reservation for a customer
found by phone/name, (4) "there is a problem in reservation that gives
403 error to customer, fix them too."

Investigated (4) first rather than guessing: `POST /bookings/bulk` was
still hard-locked to `Depends(require_customer)`, which 403s literally
any caller whose role isn't exactly `customer` — including a salon owner
or stylist trying to book someone in. That's the exact same restriction
(3) needed lifted. One fix serves both: the endpoint now accepts
`get_current_active_user` and branches — a plain customer behaves
exactly as before, while staff must pass `customer_id` and are verified
against the salon (owner must own it; stylist must be linked to it via
their `Stylist.salon_ids`) before the booking is created, auto-confirmed.

Calendar: added `jalaali-js` (a small, well-established Gregorian↔Jalali
arithmetic library — deliberately not a date-fns-jalali-style drop-in,
since that would make the same `Date`/format call sometimes mean "the
value stored" and sometimes "the label shown," an easy source of a
silent Gregorian/Jalali mixup in the booking payload). Verified its
output against known Nowruz dates (2026-03-21 → 1/1/1405, round-trip
back to 2025-03-21) before wiring it in. `utils/jalali.js` and
`PersianDatePicker.jsx` keep the split explicit: the underlying `Date`
and the `yyyy-MM-dd` string sent to the backend stay Gregorian always;
only the on-screen weekday/day/month labels go through Jalali
conversion + a hand-written Persian weekday/month name table (there's no
locale pack needed or used - just numeral conversion and name lookup).

Hit one real bug shipping this: `jalaali-js` has no default export.
`import jalaali from 'jalaali-js'` works fine under Node's `require()`
(which is how a quick standalone verification script was run) but fails
outright under Vite/Rollup's ESM build. Caught at `npm run build`, not
left for a live-browser failure — switched to the named import
(`import { toJalaali } from 'jalaali-js'`).

Staff-booking UI: new `BookForCustomerForm.jsx`, embedded in
`SalonOwnerDashboard`'s bookings tab and in `StylistDashboard` (which
now also calls a new `GET /stylists/me` to learn its own salon(s) and
pass `fixedStylistId` so a stylist booking for themselves skips the
stylist picker entirely). Customer lookup via a new `GET /users/search`
(staff-only — owner/stylist/admin).

**Data-safety note, disclosed directly rather than glossed over:** the
cleanup script after this round's live-testing used
`{'$or': [{'customer_id': {'$in': user_ids}}, {'stylist_id': {'$exists': True}}]}`
to delete test bookings. `stylist_id` is always present as a key on every
booking document (set explicitly at creation, even when `null`), so that
second clause matched *every* booking in the collection, not just test
ones - confirmed by `db.bookings.count_documents({})` returning 0
immediately after. Checked both days' full transaction logs (which have
captured every write since before the real user's account even existed)
before concluding anything: every booking ever created in this database
came from throwaway `*.test.com` accounts across every testing round;
the real account never exercised the booking flow. No real data was
lost, verified rather than assumed - but the query itself was a real
mistake and is not being repeated.

Verified live end-to-end with throwaway accounts (cleaned up correctly
this time, scoped only to the specific test user ids and salon/service
names created in this round): a real customer booking without
`customer_id` now succeeds (200) where it should always have; an owner
calling without `customer_id` is correctly rejected with a message
telling them to pass one; an owner booking on behalf of a customer
succeeds and comes back `confirmed`; a stylist booking on behalf of a
customer at their own linked salon succeeds and comes back `confirmed`;
submitting 4 boxes is rejected with a 422 (cap is 3); staff-only customer
search returns the right match and is 403 for a plain customer;
`GET /stylists/me` correctly resolves a stylist's linked salon id/name.

Commit: `Add Persian calendar, 3-box cap, and staff booking on behalf of
a customer`.

### Round 11 — submit button silently disabled, no explanation
Reported: clicking a time box, then the submit button, did nothing - and
hovering it showed a "blocked" cursor. That's the browser's default
styling for a disabled `<button>`.

Root cause: `SalonDetail.jsx`'s submit button was
`disabled={loading || selectedServiceIds.length === 0 || selectedBoxes.length === 0}`.
`handleSubmit` already had the right validation - `setError('لطفاً حداقل
یک سرویس انتخاب کنید')` etc. - but that code could never run, because a
disabled button never fires `onClick` at all. A customer who clicked a
time box before checking a service checkbox got a permanently
not-allowed cursor with zero explanation, indistinguishable from a
broken button.

Fix: the button now only disables on `loading`; the existing validation
inside `handleSubmit` runs on every click and surfaces the right message
in the error banner instead of being unreachable dead code. Checked every
other `disabled={...}` in the frontend for the same pattern (grepped all
of `frontend/src`) - `BookForCustomerForm`, `Login`, `Register`, `Profile`
already only gate on their own loading flags; `DayBoxGrid`'s
`disabled={isBusy}` is legitimate (a confirmed-busy box is visually
struck through, so there's nothing to explain).

Commit: `Stop disabling the booking submit button on unmet selections`.
