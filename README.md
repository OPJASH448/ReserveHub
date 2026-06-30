# ReserveHub - Core System Design

This document details the architecture, design choices, and data patterns for ReserveHub, a multi-tenant resource booking and access control platform.

---

## 1. System Diagram

```
[Client: React/RTK] → [Express API]
                          ├── /auth (JWT)
                          ├── /superadmin/orgs  (org approval, factory → rank-0 RoleLevel)
                          ├── /org/:id/role-levels (CRUD, OrgAdmin-only)
                          ├── /org/:id/join-request → CoR resolver
                          ├── /org/:id/resources (CRUD + RBAC Strategy middleware)
                          ├── /resources/:id/bookings (State machine + unique index)
                          ├── /resources/:id/waitlist (Observer-driven)
                          └── /cron/expire-holds (token-protected, external trigger)
                       ↓
                  [MongoDB Atlas]
                  unique compound index: {resourceId, slotStart}
                       ↑
              [cron-job.org] hits /cron/expire-holds every N min
```

---

## 2. Core Abstraction & Entity Relationships

The platform organizes access control and booking logic via a clean hierarchical chain and resource gating:

```
SuperAdmin (singleton, seeded)
   │ approves
   ▼
Org (status: pending|approved|rejected)
   │ owns
   ▼
RoleLevel (orgId, rank, name, parentRoleLevelId?)  ← chain, rank 0 = OrgAdmin
   │ binds
   ▼
User (orgId, roleLevelId)
   │ creates (if rank allows)
   ▼
Resource (orgId, allowedRoleLevelIds[] | minRank, slotConfig)
   │ generates
   ▼
Slot (resourceId, slotStart, slotEnd) — virtual or pre-materialized
   │ booked into
   ▼
Booking (resourceId, slotStart, userId, status: open|held|confirmed|expired|cancelled)
   │ on cancel/expire
   ▼
Waitlist (resourceId, slotStart, userId, position) — Observer reacts to booking-cancelled
```

### Key Rules
- **Org Isolation**: All entities (Users, RoleLevels, Resources, Bookings) are isolated at the `Org` level.
- **OrgAdmin Independence**: Nothing above `OrgAdmin` is hardcoded per-org.
- **SuperAdmin Role**: The SuperAdmin is a global singleton whose primary job is gating/approving the existence of organizations.

---

## 3. Design Patterns & Architectural Decisions

To keep the codebase maintainable, extensible, and clean, four primary design patterns are utilized:

### A. Chain of Responsibility (CoR) for Role Resolution
- **Why**: When a new user submits a join request, they request a desired `RoleLevel`. However, they may not qualify immediately (due to vacancy limits, specific onboarding policies, or approvals needing routing up the chain).
- **Mechanism**: The resolver engine walks up the hierarchy (`rank - 1`) checking handlers until a `RoleLevel` accepts. This chain terminates at `rank 0` (`OrgAdmin`), which acts as the root handler and always accepts.
- **Isolation**: Built during Day 1 in isolation with comprehensive unit tests against synthetic role chains, ensuring the core hierarchy logic works flawlessly without any HTTP or database layer complexities.

### B. Strategy Pattern for RBAC Middleware
- **Why**: The logic for checking if a user has access to a resource (e.g., `rank <= minRank`, `roleLevelId ∈ allowedRoleLevelIds`, or potentially `rank between X and Y` in the future) should be modular and easy to swap.
- **Mechanism**: Rather than hardcoding authorization conditions directly in the Express route handlers or middleware, we define comparison strategies. The correct strategy is injected into the RBAC middleware at **route-registration time**.

### C. State Machine for Bookings
- **Why**: Managing booking lifecycle transitions can quickly turn into error-prone `if/else` checks on string status values.
- **Mechanism**: Booking status transitions are managed as a strict lookup table representing valid state transitions:
  - `open` → `held` → `confirmed`
  - `held` → `expired`
  - `confirmed` → `cancelled`
- **Benefit**: This makes cron-based hold-expiry jobs and MongoDB duplicate-key race-condition handling safe to reason about.

### D. Observer Pattern for Waitlist Promotion
- **Why**: Decouples the action of cancelling or expiring a booking from the logic that decides who next gets promoted from the waitlist.
- **Mechanism**: The Booking module emits a `booking:cancelled` event. The Waitlist module subscribes to this event, pops the next user in line (`position` order), and automatically promotes them.
- **Benefit**: Ensures high cohesion and low coupling; Day 4 (Waitlist) and Day 5 (Advanced Scheduling) can be developed and unit-tested independently.

---

## 4. Concurrency & Race-Condition Handling

### The Scenario
Two users try to create a hold on the exact same resource slot (`{resourceId, slotStart}`) at the exact same moment.

### The Solution (Our Headline Concurrency Story)
1. We rely on a database-level safety net: a **unique compound index** on `{resourceId, slotStart}` within MongoDB.
2. When the parallel `held` requests hit the database, MongoDB enforces the index. One write will succeed, and the loser will immediately fail with a `MongoServerError: E11000 duplicate key error`.
3. The Express controller catches the `E11000` error and converts it to a clean `409 Conflict` HTTP response (instead of a generic `500 Internal Server Error`).
4. **Verification**: A concurrency proof script fires two parallel `axios.post` requests using `Promise.allSettled` and asserts that exactly one request succeeds (`201` or `200`) while the other fails with a `409 Conflict`.
