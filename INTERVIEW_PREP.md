# ReserveHub — Interview Preparation Guide

## Table of Contents
1. [Why This Tech Stack?](#1-why-this-tech-stack)
2. [What Does Each Technology Do?](#2-what-does-each-technology-do)
3. [Frontend-Backend Integration (With Code)](#3-frontend-backend-integration-with-code)
4. [All API Endpoints Explained](#4-all-api-endpoints-explained)
5. [All Tests Explained](#5-all-tests-explained)
6. [Docker & AWS for Interviews](#6-docker--aws-for-interviews)
7. [Core Concepts](#7-core-concepts)
8. [What's Inside node_modules?](#8-whats-inside-node_modules)
9. [Key Interview Questions & Answers](#9-key-interview-questions--answers)

---

## 1. Why This Tech Stack?

### Why Node.js instead of Python/Java/Go?

**Node.js** is JavaScript on the server. We use it because:

| Reason | Explanation |
|--------|-------------|
| **Same language front & back** | Developers write JS for React (frontend) AND Node.js (backend) — one language for everything. No context switching between Python and JavaScript. |
| **Non-blocking I/O** | Node.js uses an event-driven, non-blocking model. When the server waits for MongoDB (database) to return data, it doesn't sit idle — it processes other requests. This is called **async I/O**. |
| **npm ecosystem** | Largest package registry in the world. Need password hashing? `bcryptjs`. Need JWT? `jsonwebtoken`. Everything is one `npm install` away. |
| **Great for I/O-heavy apps** | ReserveHub is a booking platform — it does lots of database reads/writes, not CPU-heavy computation. Node.js excels here. |

**Why NOT Python?** Flask/Django have synchronous blocking by default. While async exists (FastAPI), the single-language advantage of Node.js (JS everywhere) is stronger for this project.

**Why NOT Java?** More boilerplate, slower development speed. Spring Boot is powerful but overkill for a booking API with ~40 endpoints.

### Why Express instead of Fastify/NestJS/Next.js?

**Express** is the most popular Node.js web framework:

| Feature | How We Use It |
|---------|---------------|
| **Routing** | `app.get('/api/resources', middleware, handler)` — clean, readable |
| **Middleware** | Plug-in functions that run before your route handler. We use `express.json()` to parse JSON bodies, our custom `authenticateToken` to verify JWTs |
| **Static file serving** | `express.static('./public')` serves the built React app |
| **SPA fallback** | `app.get('*', ...)` serves `index.html` for any non-API route — this is how React Router works on page refresh |

**Why NOT NestJS?** Adds TypeScript decorators, dependency injection, and a steep learning curve — unnecessary complexity for this scale.

**Why NOT Next.js?** Next.js is a full-stack React framework (server-side rendering). ReserveHub has a custom backend with MongoDB, JWT auth, and complex RBAC — decoupling frontend and backend gives us more control.

### Why MongoDB instead of SQL (PostgreSQL/MySQL)?

This is a **very common interview question**.

| MongoDB (NoSQL) | SQL (PostgreSQL) |
|-----------------|-------------------|
| **Schema-less** — documents in the same collection can have different fields | **Schema-rigid** — every row must match the table schema |
| **Embedded documents** — a booking can contain nested data like `{resourceId, slotStart, slotEnd, status}` as one document | **Normalized** — you'd need separate tables for `bookings`, `resources`, `slots` and JOIN them |
| **Horizontal scaling** — built-in sharding across many servers | **Vertical scaling** — harder to shard (though PostgreSQL has some support) |
| **Flexible for rapid development** — add fields anytime without migrations | **Migrations required** — every schema change needs an ALTER TABLE |

**Why MongoDB for ReserveHub specifically?**

1. **Rapid prototyping** — We iterate fast. Adding a `isSuperAdmin` field? Just add it to the document. No migration needed.
2. **Document structure matches our objects** — A `User` document with `{name, email, passwordHash, orgId, roleLevelId, status}` maps 1:1 to a JSON object. In SQL, you'd need JOINs across `users`, `org_members`, `user_roles` tables.
3. **Mongoose ODM** — Provides schema validation (like SQL constraints) while keeping document flexibility. Example: `email: { type: String, required: true, unique: true }` enforces uniqueness.
4. **MongoDB Atlas** — Managed cloud database, no server maintenance, free tier available.

**Tradeoff:** We lose ACID transactions for multi-document operations. But for a booking system, we handle consistency at the application level (compound indexes, retry logic).

### Why React instead of Vue/Angular/Svelte?

| React | Others |
|-------|--------|
| **Component-based** — UI = functions. `<ResourceCard />`, `<SlotGrid />` are reusable components | Vue — also component-based, but smaller ecosystem |
| **Virtual DOM** — Efficient re-rendering. Only changed elements update the real DOM | Angular — uses real DOM with change detection (can be slower) |
| **Hooks** (`useState`, `useEffect`) — Simple state management without classes | Svelte — compiled, smaller bundle, but fewer jobs |
| **Largest ecosystem** — Most libraries, tools, and community support | |
| **Most job demand** — Highest number of frontend openings | |

**React is the industry standard for frontend development.** Most companies use it.

### Why Vite instead of Create React App (CRA)?

Vite is the modern build tool that replaced CRA:

| Vite | CRA (deprecated) |
|------|------------------|
| **Fast dev server** — uses native ES modules, no bundling needed | Slow — bundles everything first |
| **Fast builds** — uses Rollup internally | Slow — uses Webpack |
| **Smaller config** — zero-config by default | Heavy — lots of boilerplate |

### Why Supabase for file storage?

Supabase is an open-source Firebase alternative. We only use its **Storage** feature (like AWS S3 but simpler). Users upload profile pictures to the `avatars` bucket. Why not store images in MongoDB? MongoDB is not designed for large binary files — it's slower and more expensive.

### Why bcryptjs for passwords?

Passwords are never stored in plain text. `bcryptjs`:
1. **Hashes** the password (one-way — can't reverse it)
2. **Salts** it (adds random data before hashing) — prevents rainbow table attacks
3. Is **slow by design** — takes ~100ms to hash, making brute-force attacks impractical

### Why JWT for authentication?

**JWT (JSON Web Token)** is a self-contained token:
```
Header.Payload.Signature
```
The server creates it, the client stores it. Every API request includes it in the `Authorization: Bearer <token>` header. The server verifies the signature (using our `ACCESS_TOKEN_SECRET`) to confirm it wasn't tampered with.

**Why not sessions?** Sessions require server-side storage (Redis or database). JWTs are stateless — the server just verifies the signature. No DB lookup needed on every request. But JWTs can't be revoked (they expire after 8 hours).

---

## 2. What Does Each Technology Do?

### Node.js

**What it is:** JavaScript runtime that runs on the server (not in a browser).

**What it does in ReserveHub:**
- Runs the Express server
- Handles all API requests (login, bookings, resources, etc.)
- Connects to MongoDB via Mongoose
- Runs the seed script on startup
- Executes the cron job to expire stale holds

**What it CAN'T do:** Heavy CPU work (video processing, complex calculations). Node.js is single-threaded for JavaScript execution.

### Express

**What it is:** A web framework for Node.js.

**What it does:**
- Defines routes: `router.get('/api/bookings/my-bookings', auth, handler)`
- Runs middleware: `app.use(express.json())` parses request bodies
- Serves static files: `app.use(express.static('public'))` serves index.html, JS, CSS
- Handles errors: our global error handler catches all thrown errors and returns 500

**Without Express, you'd have to write your own HTTP server from scratch using Node's `http` module — lots of boilerplate.**

### React

**What it is:** A library for building user interfaces.

**What it does in ReserveHub:**
- Renders the login page, dashboard, resource list, booking calendar
- Manages state (which tab is active, user data, booking data)
- Makes API calls to the backend
- Updates the UI when data changes

**Core React concepts we use:**
- `useState` — stores state like `user`, `activeTab`, `resources`
- `useEffect` — runs code when component mounts (like fetching data)
- `useCallback` — memoizes functions to prevent unnecessary re-renders
- `useRef` — references DOM elements (like auto-focusing the search input)

### MongoDB & Mongoose

**MongoDB** is the database. **Mongoose** is the ODM (Object Document Mapper).

**Mongoose provides:**
- **Schema validation** — ensures data has the right shape
- **Middleware** (pre-save hooks) — runs code before saving
- **Population** — like SQL JOINs, but in application code: `.populate('roleLevelId')` replaces an ObjectId with the actual document
- **Virtual fields, indexes, plugins**

Example Mongoose schema:
```javascript
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Org' },
  roleLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoleLevel' },
  status: { type: String, enum: ['pending', 'active', 'rejected'] }
});
```

### Docker

**What it is:** Containerization — packages your app with all its dependencies so it runs the same everywhere.

**Why we use it:**
1. **Consistency** — "It works on my machine" problem solved. The Docker image has Node.js 22, bcryptjs, express, etc. — exactly the same in dev and production.
2. **Single deployable artifact** — We build the Docker image once (with GitHub Actions), push to ECR (Docker image registry), and pull it on EC2.
3. **Multi-stage build** — Stage 1 builds React (requires dev dependencies). Stage 2 only copies the built files + production dependencies. The final image is small (~150MB instead of 1GB+).

### GitHub Actions

**What it is:** CI/CD — Continuous Integration / Continuous Deployment.

**Our pipeline (3 jobs):**
1. `test` — Runs all 26 tests on push/PR
2. `push-to-ecr` — Builds Docker image and pushes to ECR (only on main branch push)
3. `deploy` — SSHs into EC2, pulls new image, restarts container

**Why?** Every `git push origin main` automatically deploys to production. No manual SSH commands needed.

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **EC2** (Elastic Compute Cloud) | Virtual server running our Docker container |
| **ECR** (Elastic Container Registry) | Stores our Docker images (like GitHub for Docker images) |
| **IAM** (Identity & Access Management) | Creates users with specific permissions (like `github-actions` user that can only push to ECR) |

---

## 3. Frontend-Backend Integration (With Code)

### How They Connect

The React frontend and Express backend are served from **the same server** in production:

```
Browser → http://13.235.67.222/
              ↓
         Express Server (port 10000)
              ↓
         /api/... → API handler → MongoDB
              ↓
         /* → serves index.html (React SPA)
```

### Production Setup (Docker)

In the Dockerfile:
```dockerfile
# Stage 1 — Build React
FROM node:22-alpine AS client-build
COPY frontend/ .
RUN npm run build    # Output → /app/client/dist/

# Stage 2 — Express API
FROM node:22-alpine
COPY backend/ .
COPY --from=client-build /app/client/dist ./public   # Copy built React to ./public
CMD ["node", "src/server.js"]
```

In `app.js`:
```javascript
const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
  // Serve React app (index.html, JS, CSS)
  app.use(express.static(publicPath));

  // SPA fallback — any non-API route serves index.html
  app.get('*', (req, res, next) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else {
  // Dev mode — no built React
  app.get('/', (req, res) => res.json({ api: 'running' }));
}
```

### Frontend API Calls (fetchWithAuth)

```javascript
// Custom fetch wrapper in App.jsx
const fetchWithAuth = async (url, options = {}) => {
  const token = user?.accessToken;  // Get JWT from state

  // Add Authorization header
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const res = await fetch(url, { ...options, headers });

  // Auto-logout on 401 (expired JWT)
  if (res.status === 401 && user) {
    showToast('Session expired. Please log in again.', 'error');
    setUser(null);
    localStorage.removeItem('user');
  }
  return res;
};
```

**Key points:**
- `''` (empty string) as API base URL means requests go to the same origin
- In development, Vite proxies `/api` requests to the backend (port 10000)
- In production, Express serves both frontend and API on port 80 (mapped to 10000 in the container)

### Authentication Flow

```
User enters email + password
        ↓
fetch('/api/auth/login', { body: JSON.stringify({email, password}) })
        ↓
Backend:
  1. Find user by email
  2. Compare password hash (bcrypt.compare)
  3. Generate JWT (jsonwebtoken.sign)
  4. Return { accessToken, user: { id, name, email, rank, ... } }
        ↓
Frontend:
  1. Store user in state + localStorage
  2. All subsequent requests include Authorization: Bearer <token>
  3. Token expires after 8 hours → auto-logout
```

---

## 4. All API Endpoints Explained

### Auth Routes (`/api/auth`)

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | Public | Validates email+password → returns JWT |
| `/api/auth/register` | POST | Public | Creates new user with hashed password |
| `/api/auth/list-orgs` | GET | Public | Lists active organizations (for sign-up page) |
| `/api/auth/org-roles/:orgId` | GET | Public | Lists available roles for an org (excludes rank 0) |
| `/api/auth/create-org` | POST | JWT | Logged-in user creates a new org (becomes OrgAdmin) |
| `/api/auth/my-orgs` | GET | JWT | Lists orgs user belongs to |
| `/api/auth/switch-org/:orgId` | POST | JWT | Switch active organization context |

### SuperAdmin Routes (`/api/superadmin`)

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|-------------|
| `/api/superadmin/pending-orgs` | GET | JWT+SuperAdmin | List orgs waiting for approval |
| `/api/superadmin/approve-org/:orgId` | POST | JWT+SuperAdmin | Approve a pending org |
| `/api/superadmin/reject-org/:orgId` | POST | JWT+SuperAdmin | Reject a pending org |

### Role Routes (`/api/roles`)

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|-------------|
| `/api/roles` | GET | JWT | List all role levels in user's org |
| `/api/roles` | POST | JWT+OrgAdmin | Create a new role level |

### Resource Routes (`/api/resources`)

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|-------------|
| `/api/resources` | GET | JWT | List resources in user's org |
| `/api/resources` | POST | JWT | Create resource (with RBAC) |
| `/api/resources/:id` | PUT | JWT | Update resource (RBAC-checked) |
| `/api/resources/:id` | DELETE | JWT | Delete resource (RBAC-checked) |
| `/api/resources/:id/slots?date=` | GET | JWT | Generate time slots for a resource on a date |

### Booking Routes (`/api/bookings`)

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|-------------|
| `/api/bookings/hold` | POST | JWT | Temporarily hold a slot (3 min expiry) |
| `/api/bookings/:id/confirm` | POST | JWT | Confirm a held booking |
| `/api/bookings/:id/cancel` | POST | JWT | Cancel a booking (owner or admin) |
| `/api/bookings/my-bookings` | GET | JWT | Get current user's bookings |

### Waitlist Routes (`/api/waitlists`)

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|-------------|
| `/api/waitlists/join` | POST | JWT | Add user to waitlist for a booked slot |
| `/api/waitlists/resource/:resourceId` | GET | JWT | Get waitlist entries for a resource |

### Waiting Queue Routes (`/api/waiting-queue`)

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|-------------|
| `/api/waiting-queue/join` | POST | JWT | Join the org's waiting queue (request role) |
| `/api/waiting-queue/pending` | GET | JWT | Get pending queue requests user can resolve |
| `/api/waiting-queue/:queueId/resolve` | POST | JWT | Approve/reject a queue request |

### Cron Routes (`/api/cron`)

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|-------------|
| `/api/cron/expire-holds` | POST | x-cron-secret | Expire stale holds, promote waitlist users |

### Members Routes (`/api/members`)

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|-------------|
| `/api/members` | GET | JWT | Search/list org members (supports `?q=` query) |
| `/api/members/me` | GET | JWT | Get current user's profile |

### Join Request Routes (`/api/join-requests`)

| Endpoint | Method | Auth | What It Does |
|----------|--------|------|-------------|
| `/api/join-requests` | POST | Public | Unauthenticated user requests to join an org |
| `/api/join-requests/my-requests` | GET | JWT | Get user's join requests |
| `/api/join-requests/pending` | GET | JWT | Get pending requests user can resolve |
| `/api/join-requests/:id/resolve` | POST | JWT | Approve/reject a join request |

---

## 5. All Tests Explained

### Test Setup (`tests/dbHandler.js`)

Creates an **in-memory MongoDB** using `mongodb-memory-server`. Each test gets a fresh database — no data leaks between tests.

### 1. `integration.test.js` — Full E2E Flow

**What it tests:** The complete org lifecycle — registration, role hierarchy, join request approval via Chain of Responsibility.

**Key scenario:** Alice creates an org, creates DeptHead (rank 1) and Teacher (rank 2) roles. Bob requests DeptHead. Alice approves. Charlie requests Teacher. Alice does NOT see it (rank 0 can't resolve rank 2 directly) — Bob sees and rejects it.

**Why this matters:** Validates that the CoR resolver walks up the chain correctly and that users only see requests they're authorized to resolve.

### 2. `rbac.test.js` — Rank-Based Access

**What it tests:** Numeric rank comparison for resource access.

**Scenario:** A resource has `maxAllowedRank=2`. Users with rank 0, 1, 2 can access it. Rank 3, 4 are denied. SuperAdmin bypasses all checks.

**Why this matters:** Ensures the RBAC middleware correctly enforces access control.

### 3. `rbacStrategy.test.js` — Strategy Pattern

**What it tests:** The RBAC system supports injectable comparison strategies. Default is `userRank <= requiredRank`. Custom strategies can be swapped in (like strict equality or inverted logic).

**Why this matters:** Proves the system is extensible — you can change authorization rules without modifying the core code.

### 4. `resolver.test.js` — Chain of Responsibility

**What it tests:** The resolver that finds who can approve a join request.

**Scenario:** 5-level hierarchy (L0→L1→L2→L3→L4). A request for rank 3 goes to the active user at rank 2. If rank 2 has no active users, it walks up to rank 1, then rank 0.

**Why this matters:** The CoR pattern is the core of the join request system — this test validates it works correctly at every level.

### 5. `waitlist.test.js` — Waitlist Auto-Promotion

**What it tests:** When a booking is cancelled, the first waitlisted user gets auto-promoted.

**Scenario:** User A books a slot. User B joins waitlist. User A cancels. User B is automatically promoted to a booking.

**Why this matters:** Waitlist functionality is critical for the booking system — users need to know they'll get the slot if it opens up.

### 6. `cron.test.js` — Hold Expiry

**What it tests:** The cron endpoint expires stale holds and promotes waitlisted users.

**Scenario:** User A holds a slot (3 min expiry). User B joins waitlist. We manually make the hold look 10 minutes old. Cron endpoint is called. User A's booking is expired, User B is promoted.

**Why this matters:** Users who don't confirm their hold shouldn't block slots forever. The cron job cleans up.

### 7. `concurrency.test.js` — Race Conditions

**What it tests:** Two users can't book the same slot simultaneously.

**Scenario:** Two concurrent requests to hold the same slot. One succeeds (201), one gets conflict (409). Exactly 1 booking in the database.

**Why this matters:** In a real booking system, two users might click "Book" at the exact same time. MongoDB's unique compound index (`resourceId + slotStart`) prevents double-booking at the database level — even if application code has a bug.

---

## 6. Docker & AWS for Interviews

### Docker Basics

| Concept | Explanation |
|---------|-------------|
| **Image** | A read-only template (like a class). Contains your code, OS, dependencies. |
| **Container** | A running instance of an image (like an object). `docker run` creates a container. |
| **Dockerfile** | A recipe to build an image. Each instruction creates a layer. |
| **Layer caching** | Docker caches each layer. If your code changes but `package.json` doesn't, the `npm install` layer is reused. |
| **Multi-stage build** | Use multiple FROM statements. Stage 1 builds React (with dev deps). Stage 2 copies only the output + production deps. Final image is smaller. |
| **Port mapping** | `-p 80:10000` maps host port 80 to container port 10000. |

**Our Dockerfile:**
```dockerfile
FROM node:22-alpine AS builder    # Stage 1: Build React
WORKDIR /app/client
COPY frontend/ .
RUN npm run build

FROM node:22-alpine               # Stage 2: Run Express
WORKDIR /app
COPY backend/ .
COPY --from=builder /app/client/dist ./public
EXPOSE 10000
CMD ["node", "src/server.js"]
```

### AWS Basics for Interviews

| Service | One-line Explanation |
|---------|---------------------|
| **EC2** | Rent a virtual computer in the cloud. Ours is `t3.micro` (2 vCPUs, 1GB RAM). |
| **ECR** | A private Docker image registry. We push images here, EC2 pulls them. |
| **IAM** | Create users with specific permissions. `github-actions` user can only push/pull from ECR. |
| **Security Group** | Virtual firewall — controls which ports are open (22=SSH, 80=HTTP, 443=HTTPS). |
| **Key Pair** | SSH key to connect to EC2. `.pem` file = private key. |
| **VPC** | Virtual Private Cloud — your isolated network in AWS. |

**Interview tip:** Be able to explain the deployment flow:
```
git push → GitHub Actions → build Docker → push to ECR → SSH to EC2 → pull image → restart container
```

---

## 7. Core Concepts

### Async/Await

**What is async?** JavaScript is single-threaded — it can only do one thing at a time. Async allows it to start a task (like a database query), do other work while waiting, and come back when the result is ready.

```javascript
// Synchronous (blocks everything)
const result = db.find(...);    // Server freezes until DB responds
doOtherWork();                   // Never runs until DB finishes

// Asynchronous (non-blocking)
const result = await db.find(...);  // Server processes other requests while waiting
doOtherWork();                       // Runs after DB responds
```

**Why we need it:** Without async, if 100 users request bookings simultaneously, user #100 waits for users 1-99 to finish before their request is processed. With async, all 100 requests are handled concurrently.

### JWT (JSON Web Token)

A JWT has three parts separated by dots:
```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.abc123...
  (header)         (payload)              (signature)
```

- **Header** — algorithm type (HS256)
- **Payload** — data (userId, orgId, rank, expiry time)
- **Signature** — verifies the token wasn't tampered with

**Flow:**
1. User logs in → server creates JWT with `jsonwebtoken.sign({userId, rank}, SECRET, {expiresIn: '8h'})`
2. Client stores JWT in localStorage
3. Every API request includes `Authorization: Bearer <jwt>`
4. Server verifies: `jwt.verify(token, SECRET)` → gets userId, rank
5. If expired → 401 → frontend auto-logout

### RBAC (Role-Based Access Control)

Users have a numeric **rank** (0 = OrgAdmin, 1 = Faculty, 2 = Student, 3 = Worker).

Resources have a **maxAllowedRank** (e.g., Computer Lab = 2).

**Access rule:** `user.rank <= resource.maxAllowedRank`

- Admin (rank 0) can access everything (0 <= any number)
- Faculty (rank 1) can access Computer Lab (1 <= 2) but not Auditorium (1 > 1)
- Worker (rank 3) can only access resources with maxAllowedRank >= 3

**Edit/Delete rule:** `user.rank <= Math.floor(resource.maxAllowedRank / 2)`
- Computer Lab (maxRank=2): floor(2/2)=1 → rank 0 or 1 can edit
- Parking Lot (maxRank=3): floor(3/2)=1 → rank 0 or 1 can edit
- Auditorium (maxRank=1): floor(1/2)=0 → only rank 0 can edit

### Chain of Responsibility (CoR)

**What it is:** A design pattern where a request passes through a chain of handlers until one handles it.

**In ReserveHub:** When someone requests to join an org with a specific role:
1. Find the user at the role's parent level (if Student requests, check Faculty)
2. If no active Faculty member, walk up to the next level (OrgAdmin)
3. OrgAdmin sees and approves/rejects the request

**Code:**
```javascript
async function findResolver(orgId, roleLevelId) {
  let currentRole = await RoleLevel.findById(roleLevelId);
  // Walk up the chain until we find an active user at the parent level
  while (currentRole?.parentRoleLevelId) {
    currentRole = await RoleLevel.findById(currentRole.parentRoleLevelId);
    const users = await User.find({ roleLevelId: currentRole._id, status: 'active' });
    if (users.length > 0) return users;  // Found a resolver!
  }
  return [];  // No resolver found (shouldn't happen for rank 0)
}
```

### Observer Pattern

**What it is:** An object (subject) maintains a list of dependents (observers) and notifies them of state changes.

**In ReserveHub:** The `EventEmitter` is the subject. When a booking is cancelled:
1. `bookingController.cancelBooking()` emits `'booking:cancelled'` event
2. `waitlistObserver` listens for this event
3. `waitlistObserver` promotes the next user in the waitlist

```javascript
// Event emitter (events.js)
const EventEmitter = require('events');
module.exports = new EventEmitter();

// Controller emits event
events.emit('booking:cancelled', { resourceId, slotStart });

// Observer listens
events.on('booking:cancelled', async ({ resourceId, slotStart }) => {
  const nextInQueue = await Waitlist.findOne({ resourceId, slotStart }).sort({ position: 1 });
  if (nextInQueue) {
    // Create a new booking for this user
    await Booking.create({ userId: nextInQueue.userId, resourceId, slotStart, status: 'held' });
    await Waitlist.deleteOne({ _id: nextInQueue._id });
  }
});
```

### Strategy Pattern

**What it is:** Defines a family of algorithms, encapsulates each one, and makes them interchangeable.

**In ReserveHub:** The RBAC middleware accepts a comparator function. Default: `(userRank, requiredRank) => userRank <= requiredRank`. You could inject a different strategy:
```javascript
// Custom strategy — only exact rank match
checkResourceAccess(2, (userRank, requiredRank) => userRank === requiredRank)
```

### State Machine (Booking States)

A booking goes through these states:
```
open → hold (user clicks "Book")
hold → confirmed (user confirms within 3 min)
hold → expired (3 min timeout, cron job)
confirmed → cancelled (user cancels)
confirmed → expired (time passed)
hold → cancelled (user gives up hold)
```

Each transition is explicit — no "magic" state changes. The model field `status` is an enum: `['open', 'held', 'confirmed', 'cancelled', 'expired']`.

---

## 8. What's Inside node_modules?

`node_modules` contains all third-party code your project depends on. When you run `npm install`, npm downloads every package listed in `package.json` AND their own dependencies (recursively).

**Backend (205 packages):**

| Package | What It Provides |
|---------|-----------------|
| `express/` | Web framework — routing, middleware, static files |
| `mongoose/` | MongoDB ODM — schema, models, queries |
| `bcryptjs/` | Password hashing |
| `jsonwebtoken/` | JWT creation and verification |
| `dotenv/` | Load `.env` file into `process.env` |
| `cookie-parser/` | Parse HTTP cookies |
| `jest/` | Testing framework — test runner, assertions, mocking |
| `supertest/` | HTTP testing — make fake requests to your Express app |
| `mongodb-memory-server/` | Downloads and runs MongoDB in-memory for tests |
| `nodemon/` | Auto-restart server on file changes (dev only) |

**Frontend (50 packages):**

| Package | What It Provides |
|---------|-----------------|
| `react/` | UI library — components, hooks, virtual DOM |
| `react-dom/` | Renders React into the browser DOM |
| `vite/` | Build tool — dev server, bundling, HMR |
| `@supabase/supabase-js/` | Supabase client (storage uploads) |
| `lucide-react/` | SVG icon components (Shield, Users, Calendar, etc.) |
| `@vitejs/plugin-react/` | Vite plugin for JSX/React support |

**Each package inside node_modules follows this structure:**
```
express/
  package.json    # Metadata: name, version, dependencies
  index.js       # Entry point (what require('express') loads)
  lib/           # Source code
  node_modules/  # Express's own dependencies
```

---

## 9. Key Interview Questions & Answers

### Q: Why async/await instead of callbacks or promises?
**A:** Callbacks lead to "callback hell" (nested pyramids). Promises are better but still verbose (.then chains). `async/await` makes asynchronous code look synchronous — easier to read, debug, and reason about.

### Q: Why MongoDB instead of SQL?
**A:** For a booking platform that iterates quickly, MongoDB's schema flexibility allows fast changes. The document model matches our JSON objects 1:1 (no JOINs needed). MongoDB Atlas provides a free managed database. The tradeoff is no ACID transactions, but we handle consistency with compound indexes and retry logic.

### Q: How does Docker help?
**A:** Docker ensures the app runs identically on my laptop, GitHub Actions, and EC2. It packages Node.js 22, all npm packages, and the built React app into one image. Without Docker, we'd need to manually install Node.js, run npm install, and build the frontend on the server.

### Q: How does JWT authentication work?
**A:** User logs in with email+password → server verifies credentials → server creates a signed JWT containing {userId, rank} → client stores JWT in localStorage → client sends JWT in Authorization header on every request → server verifies the signature to authenticate. JWTs are stateless (no server-side storage needed) but can't be revoked.

### Q: What happens if two users book the same slot at the same time?
**A:** MongoDB has a unique compound index on `(resourceId, slotStart)`. When two concurrent requests try to insert, one succeeds and the other gets a duplicate key error (E11000). We convert this to a 409 Conflict response with a retry loop (3 attempts). The concurrency test validates this.

### Q: What is the Chain of Responsibility pattern?
**A:** A design pattern where a request passes through a chain of handlers. Each handler decides whether to process the request or pass it to the next handler. In ReserveHub, a join request for a Student role goes to Faculty first. If no active Faculty exists, it walks up to OrgAdmin.

### Q: What is the Observer pattern?
**A:** A subject (EventEmitter) maintains a list of observers. When the subject's state changes, it notifies all observers. In ReserveHub, when a booking is cancelled, the event emitter fires `'booking:cancelled'`, and the waitlist observer promotes the next user in the waitlist.

### Q: How does RBAC work in this project?
**A:** Users have a numeric rank (0-3). Resources have a `maxAllowedRank` field. Access is allowed if `user.rank <= resource.maxAllowedRank`. For edit/delete, the threshold is stricter: `user.rank <= Math.floor(maxAllowedRank / 2)`. SuperAdmin (rank 0) and the resource creator bypass all checks.

### Q: What is the Strategy pattern here?
**A:** The RBAC middleware accepts an injectable comparator function. The default is `<=`, but you could swap in `===` (exact match) or a custom function. This makes authorization rules swappable without changing the middleware code.

### Q: Why one Docker image instead of two (frontend + backend)?
**A:** Simplifies deployment — one container to manage instead of two. Express serves the built React app from `./public` using `express.static()`. The multi-stage Docker build keeps the image small by only including production dependencies in the final stage.
