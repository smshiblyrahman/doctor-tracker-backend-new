# Doctor Tracker Backend

Scalable microservices backend with API Gateway for Doctor Tracker admin portal.

## Architecture

- **api-gateway** (:5000): Rate-limiting, CORS, JWT cookie validation, route proxying.
- **auth-service** (:5001): Authentication, JWT token issuing, silent refresh, admin seeding.
- **doctor-service** (:5002): Doctor CRUD, search indexing, cascades to patient service.
- **patient-service** (:5003): Patient CRUD, multi-criteria filtering, aggregation pipelines.
- **dashboard-service** (:5004): Composes & caches metrics, trends, KPIs.
- **packages/common**: Shared error handling, auth tokens, schemas, middleware.

---

## Live Deployment (Render)

This repository includes a `render.yaml` blueprint deploying all microservices.

### Where to Put MongoDB URL?
MongoDB URLs belong in **Render**, NOT Vercel. Frontend never connects to MongoDB directly.

1. **Get MongoDB Atlas URL**:
   Format:
   `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
2. **In Render Dashboard**:
   - Go to each created service under **Environment** tab:
     - **doctor-tracker-auth**: Add `MONGO_URI` -> `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/doctor_tracker_auth?retryWrites=true&w=majority`
     - **doctor-tracker-doctors**: Add `MONGO_URI` -> `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/doctor_tracker_doctors?retryWrites=true&w=majority`
     - **doctor-tracker-patients**: Add `MONGO_URI` -> `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/doctor_tracker_patients?retryWrites=true&w=majority`
3. **Set Secrets in Render**:
   - `JWT_ACCESS_SECRET`: 32+ character random secret (same across auth and gateway).
   - `INTERNAL_JWT_SECRET`: 32+ character random secret (same across all 5 services).
   - `CLIENT_URL`: Your Vercel frontend URL (e.g. `https://doctor-tracker-frontend-new.vercel.app`).

---

## Local Development (Docker)

```bash
# Start all 5 microservices + MongoDB
docker compose up -d --build

# Verify health
curl http://localhost:5050/health/services
```

Default gateway port: `5050` (or `5000`).
Default seeded admin: `admin@doctortracker.dev` / `Admin@12345`.

