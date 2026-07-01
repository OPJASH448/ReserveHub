# ReserveHub - Core System Design & Implementation

This repository contains the backend engine for **ReserveHub**, a multi-tenant resource booking and access control platform.

---

## 1. Architecture Overview

```
[Client: React/RTK] → [Express API]
                          ├── /auth (JWT - Access Token Only)
                          ├── /superadmin/orgs  (Org approval, factory → rank-0 RoleLevel)
                          ├── /roles (CRUD, OrgAdmin-only)
                          ├── /join-requests → CoR resolver
                          ├── /resources (CRUD + RBAC Strategy middleware)
                          └── /bookings (State machine + unique index)
                       ↓
                  [MongoDB Atlas]
                  unique compound index: {resourceId, slotStart}
```

---

## 2. Core Entities

The platform organizes access control and booking logic via a clean hierarchical chain and resource gating:

- **SuperAdmin**: Platform administrators, stored in a dedicated `SuperAdmin` collection. Responsible for gating/approving organizations.
- **Org**: Isolated tenant organizations (`pending`, `active`, `rejected`).
- **RoleLevel**: Dynamic, hierarchy pointers defining ranks (`rank 0` is highest, e.g., `OrgAdmin`).
- **User**: User accounts bound to an `Org` and a `RoleLevel`.
- **Resource**: Gatekeepers containing authority ceilings (`maxAllowedRank`), operating hours, and booking slot duration settings.
- **Booking**: Bookings mapped to slots, running through a status state machine (`held`, `confirmed`, `expired`, `cancelled`).
- **Waitlist**: Slot waitlist queue positions for users waiting for resource slot promotion.

---

## 3. Implemented Design Patterns & Architecture

### A. Chain of Responsibility (CoR) Resolver
- **Pattern**: A request to join an organization specifies a desired `RoleLevel`. If the immediate parent level has no active users to authorize the request, the resolver walks up the role hierarchy (`parentRoleLevelId` DAG chain) until it finds a level with active users to resolve the request. The chain halts at `rank 0` (OrgAdmin) as the fallback resolver.
- **Implementation**: Fully implemented in `src/utils/resolver.js` and wired up to the `GET /api/join-requests/pending` and `POST /api/join-requests/:requestId/resolve` endpoints.

### B. Strategy Pattern for RBAC Middleware
- **Pattern**: Dynamic resource access checks compare the requester's numeric rank against the resource's `maxAllowedRank`. By default, it uses `(userRank, requiredRank) => userRank <= requiredRank`. To support modular and customizable access rules, the middleware accepts an injected comparator strategy.
- **Implementation**: Fully implemented in `src/middleware/auth.js` (`checkResourceAccess`) and unit tested in `tests/rbacStrategy.test.js`.

### C. State Machine for Bookings
- **Pattern**: Valid status transitions are explicitly checked against a transition table to prevent invalid workflow states.
  - `held` → `confirm` → `confirmed`
  - `held` → `cancel` → `cancelled`
  - `held` → `expire` → `expired`
  - `confirmed` → `cancel` → `cancelled`
- **Implementation**: Enforced in `src/controllers/bookingController.js`. Stale holds (older than 5 minutes) are expired lazily on booking attempts and slot checks.

### D. Concurrency & Duplicate Gating (E11000 → 409)
- Enforces timeslot exclusivity at the database layer with a compound unique index on `{ resourceId, slotStart }` for active bookings.
- Under high concurrency, when two booking requests attempt to write to the database at the exact same time, MongoDB rejects the second transaction with an `E11000 duplicate key error`.
- The Express controller intercepts the `E11000` error and translates it to a clean `409 Conflict` HTTP response: `{"error": "This slot is already booked or held"}`.

---

## 4. Setup & Running

### Requirements
- Node.js (>= 18.0.0)
- npm

### Installation
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Seeding Script
To seed the initial global `SuperAdmin` into the database:
```bash
npm run seed:superadmin
```

### Running the Test Suite
Tests are implemented using Jest and run against an in-memory replica set (`MongoMemoryReplSet` for transaction/concurrency support):
```bash
npm test
```
The test suite validates:
1. `rbacStrategy.test.js` - Isolated RBAC injected strategy unit tests.
2. `concurrency.test.js` - Automated race-condition tests asserting `201 Created` vs `409 Conflict`.
3. `integration.test.js` - Full end-to-end organization approval, role creation, and CoR join requests.
4. `resolver.test.js` - Chain of Responsibility resolver checks on 2-level and 4-level synthetic hierarchies.
5. `rbac.test.js` - Rank authority validation checks.

### Running the Concurrency Race Test Script
The race test script runs a self-contained test server, triggers two concurrent Axios POST requests to hold the same slot, checks the database state, and writes the output log:
```bash
npm run race-test
```
The execution logs are saved to:
- `docs/race_log.txt`
- `backend/docs/race_log.txt`
