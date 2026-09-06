# Project Handoff — Salon Booking System

Status snapshot as of 2026-09-06. This document exists to bring a new
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
  admin/owner views, defaults to active+visible), `GET /salons/mine`
  (owner; every salon they own, any status), get one, update (owner),
  `POST /salons/{id}/images` (owner; appends a photo to the gallery)
- `admin.py` — `PUT /admin/salons/{id}/status` — approve/reject/toggle
  visibility (admin/super_admin)
- `services.py` — `POST /services/salon/{salon_id}` (owner), list by salon
  (public), update/soft-delete (owner)
- `chairs.py` — `POST /chairs/salon/{salon_id}` (owner), list by salon
  (public), `POST /chairs/{id}/image` (owner; sets/replaces the photo)
- `stylists.py` — `POST /stylists/salon/{salon_id}/create-account` (owner;
  creates the barber's login **and** their stylist profile together —
  see history below for why), `POST /stylists/` (link an existing
  stylist-role user to more salons), `GET /stylists/salon/{salon_id}`
  (public; joins in the linked user's name/email/phone)
- `bookings.py` — `POST /bookings/` (single booking; customer, server
  computes `end_time`/`total_price` from the selected services),
  `POST /bookings/bulk` (customer; the slot-box flow — see below),
  `GET /bookings/me`, `GET /bookings/salon/{salon_id}` (owner; joins in
  service names and customer name/phone for display),
  `GET /bookings/stylist/me` (any user; empty list if they have no
  stylist profile, otherwise their assigned bookings, same joined shape),
  `PUT /bookings/{id}/status` (customer/owner/assigned stylist — see
  Booking status permissions below)
- `logs.py` — `GET /logs/` (admin-only) — queries today's transaction log,
  filterable by `collection`/`action`/`actor_id`

## Booking model: slot boxes + independent per-box acceptance

A salon's `min_booking_interval` (already existed on the `Salon` model,
15/30/60 minutes, now settable in the salon creation form) defines the
size of one bookable "box." A customer can select **multiple** boxes in
one visit to `BookingPage`; `POST /bookings/bulk` creates one fully
independent `Booking` document per selected box (same `service_ids`,
`total_price`, `stylist_id`/`chair_id`, all sharing one `group_id` so
they're traceable as one customer request), each starting life as
`pending`. There is no merging or "this batch succeeds/fails together"
behavior — the owner or the assigned stylist reviews each box on its own
and can confirm any subset: all of them, some of them, or none. This
directly implements the request: "customer reserves 2 boxes, salon owner
can accept 1, 2, or none of them."

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
  `/salon/:salonId/book`, `/admin`, `/owner-dashboard`,
  `/stylist-dashboard`, `/profile` (last four are role-gated — `/profile`
  just requires being logged in, any role — via a `ProtectedRoute` wrapper)
- `store/authStore.js` — zustand store, persisted to localStorage:
  `token`, `user`, `isAuthenticated`, `login()`, `logout()`, `setUser()`
  (used after an avatar upload to refresh the stored user without a full
  re-login), and `isSuperAdmin()/isAdmin()/isSalonOwner()/isStylist()/
  isCustomer()` role checks
- `api/` — `axiosConfig.js` (injects the bearer token, logs out on 401,
  exports `fileUrl()` to resolve `/uploads/...` paths against the backend
  origin), `salons.js`, `bookings.js`, `services.js`, `stylists.js`,
  `chairs.js`, `profile.js`
- `components/LocationPicker.jsx` — `react-leaflet` + OpenStreetMap tiles
  (no API key needed), click-to-place-marker map; used by the salon
  creation form
- `components/BookingList.jsx` — shared by `SalonOwnerDashboard`'s
  "bookings" tab and `StylistDashboard`: renders a booking's date/time/
  services/customer/price/status and the status-appropriate action
  buttons (pending → confirm/reject, confirmed → complete/cancel,
  cancel_requested → confirm the cancellation), calling back with
  `onStatusChange(bookingId, newStatus)`
- **Pages**: `Home` (salon browse grid), `SalonDetail` (service picker →
  hands off to booking), `BookingPage` (multi-select time-box grid sized
  by the salon's `min_booking_interval`, optional chair/stylist pick per
  the salon's management mode, submits via `POST /bookings/bulk` — see
  Booking model above), `Login`, `Register`, `Profile` (avatar upload,
  any logged-in user), `AdminPanel` (salon approval queue, approve/reject
  wired to the real admin endpoint), `SalonOwnerDashboard` (create salons
  with a map-picked location and a slot-interval selector; each salon
  card shows its photo gallery with an upload button; real "add a barber"
  form + stylist list on the stylists tab; "Chairs" tab; "bookings" tab
  now a real `BookingList` per salon), `StylistDashboard` (now a real
  `BookingList` of bookings assigned to that stylist, via
  `GET /bookings/stylist/me`)

## Known remaining gaps

Not blockers to running the app, but real gaps to close next:

- **No booking-conflict checking.** `Stylist.work_schedules` and existing
  bookings aren't checked against a new booking's time slot — a customer
  (or several different customers) can request the same box repeatedly;
  nothing stops the owner from confirming overlapping bookings either.
- **Box length vs. service duration isn't reconciled.** Each booking box
  always lasts exactly `min_booking_interval` regardless of the selected
  services' actual total duration — see Booking model above.
- **No chair-based booking *conflict* UI for customers** — chair
  *management* exists (owner dashboard's "Chairs" tab), and `BookingPage`
  now lets a customer optionally pick a chair/stylist, but nothing shows
  a chair's or stylist's existing bookings to help the customer avoid
  picking an already-busy one — they're just picking blind and relying on
  the owner/stylist to reject conflicts.
- **`StylistDashboard`** still has no working-schedule management (only a
  booking list now).
- **Self-registration as `super_admin`** — see Roles above.
- **No edit/delete for salon photos or chairs** — you can add a photo to a
  salon's gallery or set a chair's photo, but there's no UI (or endpoint)
  to remove one, and the salon card's "ویرایش" (edit) button is still
  dead — no edit-salon form exists yet, so location/name/etc. can't be
  changed after creation, only appended to (photos) or approved (admin).

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
