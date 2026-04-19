# AETI Reseller Onboarding Platform

Full-stack web application for PCS reseller onboarding at `pcsww.com/aeti`.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend API | Node.js + Express |
| Database | PostgreSQL (Azure Database for PostgreSQL) |
| File storage | Azure Blob Storage (AES-256, private) |
| Async queue | Azure Service Bus (push-based worker) |
| NDA signing | Adobe Acrobat Sign (OAuth 2.0, library template) |
| CRM/ERP | NetSuite REST API (OAuth 1.0a TBA) |
| Email | SendGrid Dynamic Templates |

---

## Deployment

| Component | Azure Service |
|---|---|
| Frontend | Azure Static Web Apps |
| Backend API | Azure App Service (`abti-api`) |
| Worker | Azure App Service (`abti-worker`) |
| Database | Azure Database for PostgreSQL |
| File storage | Azure Blob Storage |
| Queue | Azure Service Bus |

CI/CD is handled via GitHub Actions. Pushes to the `staging` branch deploy to the current environment.

---

## Project structure

```
.
├── frontend/                  # React app (Vite)
│   └── src/
│       ├── components/
│       │   ├── layout/        # Navbar, Footer
│       │   ├── landing/       # Hero, Revenue, Partnership, Quote, HowItWorks
│       │   ├── dashboard/     # Dashboard, DetailModal
│       │   └── form/          # ProgressIndicator, Step1-4, Confirmation, OnboardingForm
│       └── App.jsx
├── backend/
│   └── src/
│       ├── app.js             # Express app
│       ├── server.js          # HTTP server entry point
│       ├── db/                # PostgreSQL pool + migrations
│       ├── middleware/        # Rate limiter, auth, multer upload
│       ├── routes/            # /api/submit, /acrobat/webhook, /api/dashboard
│       ├── services/          # s3, queue, acrobat-sign, netsuite, sendgrid, pdf
│       └── workers/           # onboarding-worker.js (Service Bus consumer)
└── docker-compose.yml         # PostgreSQL for local dev
```

---

## Reseller status flow

```
Initiated → NDA Approval Pending → NDA Pending → Awaiting Countersign → NDA Complete
                    ↓
                (delete)
```

- **Initiated** — form submitted, worker not yet processed
- **NDA Approval Pending** — worker processed; awaiting dashboard approval before sending envelope
- **NDA Pending** — Acrobat Sign envelope sent to reseller for signing
- **Awaiting Countersign** — reseller signed; awaiting PCS Legal countersignature
- **NDA Complete** — fully signed; welcome email with signed NDA and program letter sent

---

## Local development

### Prerequisites
- Node.js 20+
- Docker Desktop

### 1. Start local database

```bash
docker compose up -d
```

This starts PostgreSQL on `:5432`.

### 2. Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — fill in Azure, Acrobat Sign, NetSuite, SendGrid credentials
```

### 4. Run database migrations

```bash
cd backend && npm run migrate
```

### 5. Start all processes (3 terminals)

```bash
# Terminal 1 — Backend API
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev

# Terminal 3 — Worker
cd backend && npm run worker
```

Frontend: http://localhost:3000  
Backend: http://localhost:4000

---

## Environment variables

See [backend/.env.example](backend/.env.example) for all required variables.

### Key groups

**Azure**
- `AZURE_STORAGE_CONNECTION_STRING` — Blob Storage connection string
- `AZURE_BLOB_CONTAINER` — container name (default: `reseller-docs`)
- `AZURE_SERVICE_BUS_CONNECTION_STRING` — Service Bus connection string
- `AZURE_SERVICE_BUS_QUEUE_NAME` — queue name (default: `onboarding-jobs`)

**Database**
- `DATABASE_URL` — PostgreSQL connection string

**Acrobat Sign**
- `ACROBAT_CLIENT_ID` / `ACROBAT_CLIENT_SECRET` — OAuth 2.0 app credentials
- `ACROBAT_REFRESH_TOKEN` — long-lived refresh token
- `ACROBAT_NDA_TEMPLATE_ID` — library document ID for the NDA template
- `ACROBAT_API_BASE_URL` — API base (default: `https://api.na1.adobesign.com`)
- `PCS_LEGAL_EMAIL` / `PCS_LEGAL_NAME` — countersigner details

**NetSuite**
- `NETSUITE_ACCOUNT_ID`, `NETSUITE_CONSUMER_KEY`, `NETSUITE_CONSUMER_SECRET`
- `NETSUITE_TOKEN_ID`, `NETSUITE_TOKEN_SECRET`
- `NETSUITE_FINANCE_EMPLOYEE_ID`, `NETSUITE_LEGAL_EMPLOYEE_ID` — task assignees (optional)

**SendGrid**
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`, `SENDGRID_SUPPORT_EMAIL`
- `SENDGRID_TEMPLATE_WELCOME`, `SENDGRID_TEMPLATE_INTERNAL_ALERT` — dynamic template IDs

**Internal routing**
- `PCS_OPS_EMAIL` — receives internal alert on each new submission

---

## API reference

### `POST /api/submit`
Accepts `multipart/form-data`. Required: all Step 1 + Step 2 fields plus the `w9` file.  
Returns `202 Accepted`. All integration work (NetSuite, Acrobat Sign, email) happens asynchronously in the worker.

### `POST /acrobat/webhook`
Acrobat Sign event callback. On `AGREEMENT_WORKFLOW_COMPLETED` events, updates reseller status and enqueues `NDA_COMPLETED`.

### `GET /api/dashboard/resellers`
Returns all resellers ordered by submission date. Requires dashboard JWT auth.

### `POST /api/dashboard/resellers/:id/send-nda`
Approves and sends the Acrobat Sign NDA envelope. Only valid when status is `NDA Approval Pending`.

### `POST /api/dashboard/resellers/:id/resend-nda`
Sends a reminder to the reseller (`NDA Pending`) or PCS Legal (`Awaiting Countersign`).

### `POST /api/dashboard/resellers/:id/cancel-nda`
Cancels the in-progress agreement and sets status to `Cancelled`.

### `DELETE /api/dashboard/resellers/:id`
Deletes the reseller record and all associated blob files. Only allowed for `Cancelled`, `Initiated`, and `NDA Approval Pending` statuses.

### `GET /health`
Returns `{ status: "ok" }`.
