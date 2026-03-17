# AETI Reseller Onboarding Platform

Full-stack web application for PCS reseller onboarding at `pcsww.com/aeti`.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend API | Node.js + Express |
| Database | PostgreSQL 16 |
| File storage | AWS S3 (AES-256 SSE, private ACL) |
| Async queue | AWS SQS (long-polling worker) |
| NDA signing | DocuSign (JWT Grant, Connect webhook) |
| CRM/ERP | NetSuite REST API (OAuth 1.0a TBA) |
| Email | SendGrid Dynamic Templates |
| Local infra | LocalStack (S3 + SQS emulation) |

---

## Project structure

```
.
├── frontend/                  # React app (Vite)
│   └── src/
│       ├── components/
│       │   ├── layout/        # Navbar, Footer
│       │   ├── landing/       # Hero, Revenue, Partnership, Quote, HowItWorks
│       │   └── form/          # ProgressIndicator, Step1-4, Confirmation, OnboardingForm
│       └── App.jsx
├── backend/
│   └── src/
│       ├── app.js             # Express app
│       ├── server.js          # HTTP server entry point
│       ├── db/                # PostgreSQL pool + migrations
│       ├── middleware/        # Rate limiter, multer upload
│       ├── routes/            # /api/submit, /docusign/webhook
│       ├── services/          # s3, queue, docusign, netsuite, sendgrid
│       └── workers/           # onboarding-worker.js (SQS consumer)
└── docker-compose.yml         # PostgreSQL + LocalStack for local dev
```

---

## Local development

### Prerequisites
- Node.js 20+
- Docker Desktop

### 1. Start local infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL on `:5432` and LocalStack (S3 + SQS) on `:4566`.

### 2. Create LocalStack resources

```bash
# Create S3 bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://aeti-reseller-docs

# Create SQS queue
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name aeti-onboarding
```

### 3. Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 4. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — fill in DocuSign, NetSuite, SendGrid credentials
```

### 5. Run database migrations

```bash
cd backend && npm run migrate
```

### 6. Start all processes (3 terminals)

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
LocalStack: http://localhost:4566

---

## Environment variables

See [backend/.env.example](backend/.env.example) for all required variables with descriptions.

### Critical configuration

**DocuSign**
- Create an app in the DocuSign developer portal
- Generate an RSA key pair — save the private key to `backend/docusign.key`
- Grant consent to the integration key
- Create the NDA template in DocuSign and copy the Template ID
- Configure a DocuSign Connect webhook pointing to `https://your-domain/docusign/webhook` — copy the HMAC secret

**NetSuite**
- Enable Token-Based Authentication in NetSuite setup
- Create an integration record and generate consumer key/secret
- Create a token and note the token ID/secret
- Create the custom field `custentity_onboarding_status` on the Vendor record

**SendGrid**
- Create two Dynamic Templates: welcome email (with NDA attachment) and internal ops alert
- Add the template IDs to `.env`

---

## Deployment notes

- Remove `AWS_ENDPOINT` from production env — the SDK will use real AWS endpoints
- Use IAM roles instead of access keys in production
- Set `DOCUSIGN_BASE_PATH` to the production DocuSign URL
- Enable column-level encryption for the `ein` field using pgcrypto or AWS KMS
- Place the backend behind a reverse proxy (nginx/ALB) with TLS termination
- Set up a dead-letter queue for the SQS queue to catch repeatedly failing jobs

---

## API reference

### `POST /api/submit`
Accepts `multipart/form-data`. Fields map to the data model in the PRD. Required: all Step 1 + Step 2 fields plus the `w9` file.

Returns `202 Accepted` on success. Downstream processing (DocuSign, NetSuite, SendGrid) happens asynchronously.

### `POST /docusign/webhook`
DocuSign Connect callback. Verifies HMAC-SHA256 signature before processing. On `envelope-completed` events, enqueues the `NDA_COMPLETED` job.

### `GET /health`
Returns `{ status: "ok" }`.
