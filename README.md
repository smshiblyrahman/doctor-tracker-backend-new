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

## Live Deployment (Render - Single Web Service)

This repository includes `server.unified.tsx` and `render.yaml` to run all microservices (`auth`, `doctor`, `patient`, `dashboard`) + `api-gateway` in a single Render Web Service (free tier friendly, no cross-service networking latency, all Swagger docs unified).

### Environment Variables on Render
Go to your Render Web Service -> **Environment** tab:

| Key | Value / Example | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net` | Base MongoDB Atlas URI (databases `doctor_tracker_auth`, `doctor_tracker_doctors`, `doctor_tracker_patients` are created automatically) |
| `JWT_ACCESS_SECRET` | `dev-access-secret-change-me-0123456789abcdef` | 32+ char secret for JWT auth cookies |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret-change-me-0123456789abcdef` | 32+ char secret for refresh tokens |
| `INTERNAL_JWT_SECRET` | `dev-internal-secret-change-me-0123456789abcd` | 32+ char secret for inter-service communication |
| `CLIENT_URL` | `http://localhost:3000,https://doctor-tracker-frontend-new.vercel.app` | Allowed CORS origins for browser cookies |
| `COOKIE_SECURE` | `true` | Required for HTTPS on Render & Vercel |
| `COOKIE_SAMESITE` | `none` | Required for cross-domain cookies (Vercel frontend -> Render backend) |
| `NODE_ENV` | `production` | Production environment |

### Root Health Check & API Docs
- Root URL: `GET https://<your-service>.onrender.com/` returns HTTP 200 `{ "success": true, "message": "Backend API is running successfully!" }`.
- Swagger Docs: `GET https://<your-service>.onrender.com/api-docs` returns live interactive docs for all service endpoints.

---

## Local Development (Docker)

```bash
# Start all 5 microservices + MongoDB
docker compose up -d --build

# Verify health
curl http://localhost:5050/health/services
```

Default gateway port: `5050` (or `5000`).
Default seeded accounts:
- **Admin:** `admin@doctortracker.dev` / `Admin@12345`
- **Patient:** `patient@doctortracker.dev` / `Patient@12345`

