# ReserveHub

ReserveHub is a multi-tenant resource booking platform featuring dynamic Role-Based Access Control (RBAC), automatic waitlist promotion via an Observer pattern, and a robust Chain of Responsibility (CoR) join request resolver.

---

## 🚀 Key Features

### Day 1: Multi-Tenant Architecture & CoR Resolver
- **Multi-Tenant Mongoose Schemas**:
  - `SuperAdmin`: Global platform administrators.
  - `Org`: Organization accounts (`pending`, `active`, `rejected`).
  - `RoleLevel`: Organization role levels with unique names, hierarchical rank values, and optional parent linkages.
  - `User`: Organization users (`pending` by default, `active`, `rejected`).
  - `JoinRequest`: Join requests created on user signup.
- **Access-Token Auth**: ACCESS_TOKEN-only stateless JWT authorization.
- **Org Lifecycle approval & rank-0 creation factory**: When a SuperAdmin approves an org, the creator user is activated, and a rank-0 `'OrgAdmin'` role is created automatically.
- **Chain of Responsibility (CoR) Resolver**: Approvals route dynamically up the `parentRoleLevelId` DAG chain. If intermediate roles are empty, the CoR engine traverses up to active eligible resolvers.

### Day 2: Concurrency & Booking Engine
- **RBAC Strategy Middleware**: Dynamic resource access checks comparing user rank against the resource's `maxAllowedRank` threshold.
- **State-Machine Bookings**:
  - Transition table enforcement for booking statuses: `held` ➔ `confirmed` / `cancelled` / `expired`.
  - Stale holds expire lazily in 5 minutes.
- **E11000 Error Interception**: Compound unique index `{ resourceId, slotStart }` handles concurrent slot bookings, mapping database duplicates to clean `409 Conflict` HTTP responses.
- **Automated Concurrency Proof**: Race condition integration tests triggering simultaneous Axios requests to guarantee exactly one request succeeds and the other receives a `409 Conflict`.

### Day 3: Waitlist Observer & React Frontend
- **Waitlist Observer Promotion**:
  - Global event emitter tracking `booking:cancelled` and `booking:expired` events.
  - The waitlist observer listens to cancellations, queries the next pending user in the slot queue, and promotes them to a `held` booking inside a database transaction.
- **Hold Expiry Cron Endpoint**:
  - Protected `POST /api/cron/expire-holds` checking the shared secret in the `x-cron-secret` header.
  - Transitions stale holds (older than 5 minutes) to `expired` and emits a cancellation event.
- **Vite React + RTK Frontend**:
  - Form-based RoleLevel CRUD.
  - **Template Method Hierarchy View**: A single hierarchical component displaying roles rendered dynamically by rank.
  - **RBAC-Driven Booking Page**: Fetches virtual slot grids. If the user lacks rank access, the page displays a clean 403 error returned directly by the backend RBAC check.
  - **Generic Approval Inbox**: Reused across all ranks to resolve incoming organization signups.

---

## 🛠️ Tech Stack
- **Backend**: Node.js, Express, MongoDB (Mongoose), Jest, Supertest
- **Frontend**: React, Vite, CSS (Vanilla Custom Styling)

---

## 🏃 Getting Started

### 1. Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```env
PORT=10000
MONGO_URI=mongodb://localhost:27017/reservehub
ACCESS_TOKEN_SECRET=access_secret_12345
CRON_SECRET=cron_secret_12345
```

### 2. Run the Backend
```bash
cd backend
npm install
npm run dev
```

### 3. Run the Frontend
Vite is pre-configured with a dev server proxy forwarding `/api` calls directly to the Express server at `http://localhost:10000`.
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Testing

ReserveHub contains a comprehensive Jest integration and unit test suite comprising **26 tests** covering auth, resolver traversal, RBAC strategy middleware, booking states, concurrency races, waitlist observer promotions, and cron operations.

Run the tests inside the `backend/` folder:
```bash
npm test
```
