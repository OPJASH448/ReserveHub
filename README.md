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

---

## Docker (Single Image — Express Serves Built React)

A single `Dockerfile` at the project root builds the React frontend in Stage 1 and bundles it into the Express backend image under `./public`. Express serves the SPA as static files.

### Build & Run Locally

```bash
# Build the image
docker build -t reservehub .

# Run with .env pointing to your MongoDB (Atlas or local)
docker run -d -p 5000:5000 --env-file .env --name reservehub reservehub
```

Open `http://localhost:5000` — the same port serves both the API and the frontend.

### Local Dev with Docker Compose (MongoDB included)

```bash
# 1. Create .env (or copy from .env.example)
cp .env.example .env

# 2. Start app + mongo:6
docker compose up -d

# 3. Open http://localhost:5000
```

The `docker-compose.yml` starts a local MongoDB 6 container with a persistent volume and connects the app service to it. For MongoDB Atlas, update `MONGODB_URI` in `.env` and remove the `mongo` service from the compose file.

---

## CI/CD Pipeline (GitHub Actions + ECR)

### Workflow: `.github/workflows/ci.yml`

| Job | Triggers | Description |
|-----|----------|-------------|
| `test` | push/PR to `main` | Runs Jest test suite inside `backend/` |
| `docker-build-push` | push to `main` (only after `test` passes) | Builds Docker image, tags it, pushes to Amazon ECR |

### Setup Required

1. **Create ECR repository** named `strata` in `ap-south-1`:
   ```bash
   aws ecr create-repository --repository-name strata --region ap-south-1
   ```

2. **Add GitHub Secrets**:
   | Secret | Value |
   |--------|-------|
   | `AWS_ACCESS_KEY_ID` | IAM user access key with `AmazonEC2ContainerRegistryFullAccess` |
   | `AWS_SECRET_ACCESS_KEY` | Corresponding secret key |

3. Push to `main` — tests run first; if they pass, the image is built and pushed to ECR automatically.

---

## AWS EC2 Deployment (t3.micro)

### Launch Instance

1. Open EC2 Console → Launch Instance
2. Name: `reservehub-prod`
3. AMI: **Amazon Linux 2023** (Free Tier eligible)
4. Instance type: **t3.micro**
5. Key pair: Create or select existing
6. Security group rules:
   - **HTTP** (80) — `0.0.0.0/0`
   - **HTTPS** (443) — `0.0.0.0/0` (if using TLS)
   - **SSH** (22) — your IP only
7. **Advanced → User data**: paste the script from `scripts/ec2-user-data.sh` (replace `<ACCOUNT_ID>` with your AWS account ID and fill in secrets)
8. Launch

### Manual Deploy (if not using user-data)

```bash
# SSH into the instance
ssh -i your-key.pem ec2-user@<PUBLIC_IP>

# Install Docker
sudo dnf install -y docker
sudo systemctl enable docker; sudo systemctl start docker

# Login to ECR
aws ecr get-login-password --region ap-south-1 | sudo docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# Pull and run
sudo docker pull <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/strata:latest
sudo docker run -d -p 80:5000 --env-file .env --name reservehub <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/strata:latest
```

### Verification

```bash
curl http://<PUBLIC_IP>/api/
# → {"message":"ReserveHub API Engine is running"}

curl http://<PUBLIC_IP>/
# → HTML of the React SPA
```

### Clean Up

```bash
# Stop and remove the container
sudo docker stop reservehub && sudo docker rm reservehub

# Terminate the instance (EC2 Console → Instance State → Terminate)
```

> Always terminate the EC2 instance when done to avoid unexpected charges. The Free Tier covers 750 hours/month of t3.micro.

---

## Project Structure

```
ReserveHub/
├── .dockerignore
├── .env.example
├── .github/workflows/ci.yml
├── docker-compose.yml
├── Dockerfile
├── README.md
├── backend/
│   ├── package.json
│   ├── Dockerfile           # Standalone backend image (not used in single-image setup)
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── observers/
│       ├── routes/
│       ├── utils/
│       └── tests/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf           # Only used in the legacy 2-container setup
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── index.css
│       ├── main.jsx
│       └── supabase.js
└── scripts/
    └── ec2-user-data.sh
```
