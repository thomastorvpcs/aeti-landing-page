# AETI Landing Page — Project Overview

## Git Workflow

After completing any code change, always commit and push automatically without waiting to be asked. Use a concise, descriptive commit message.

## Tech Stack

### Frontend
- **React 18** with **Vite**
- **Tailwind CSS**
- **Axios** — HTTP client
- **react-dropzone** — file upload UI

### Backend
- **Node.js / Express**
- **PostgreSQL** (`pg`) — primary database
- **AWS S3** — file storage (W-9, bank letter, vendor setup form PDFs)
- **AWS SQS** — job queue for async onboarding processing
- **PDFKit** — PDF generation
- **Carbone** — template-based document generation
- **SendGrid** — transactional email
- **Multer + multer-s3** — multipart file upload directly to S3
- **Helmet + express-rate-limit** — security middleware
- **JWT** (`jsonwebtoken`) — auth tokens
- **NetSuite REST API** — vendor creation (via Axios)

---

## Architecture

**Async-first:** Form submission returns `202 Accepted` immediately and enqueues an SQS job. All integration work (NetSuite, Acrobat Sign, email) happens in the worker process.

**Idempotent submissions:** EIN is a unique key — resubmissions update rather than duplicate.

**File handling:** Multer streams uploads directly to S3 (no temp files on disk).

**Polling fallback:** Worker polls Acrobat Sign every 5 minutes to catch missed webhook events.

---

## Naming Conventions

| Context | Convention |
|---|---|
| Database columns | `snake_case` |
| JS functions & variables | `camelCase` |
| Constants / env vars | `SCREAMING_SNAKE_CASE` |
| SQS job types | `SCREAMING_SNAKE_CASE` (e.g. `RESELLER_SUBMITTED`, `NDA_COMPLETED`) |
| React components | `PascalCase` |
| File names | `kebab-case` (e.g. `acrobat-sign.js`, `rate-limit.js`) |
| S3 keys | `snake_case` filenames under `resellers/{id}/` |

---

## S3 Key Structure

```
resellers/{resellerId}/w9.{ext}
resellers/{resellerId}/bank_letter.{ext}
resellers/{resellerId}/vendor_setup_form.pdf
resellers/{resellerId}/signed_nda.pdf
```

All files use AES-256 SSE, private ACL (no public URLs).

---

## Worker Job Types

| Job | Trigger | Actions |
|---|---|---|
| `RESELLER_SUBMITTED` | Form submission | Create NetSuite vendor → upload vendor setup form PDF → create finance task → send NDA via Acrobat Sign → send internal alert |
| `NDA_COMPLETED` | Acrobat Sign webhook or polling | Download signed NDA → archive to S3 → update NetSuite status → create legal task → send welcome email with authorization letter |

Worker uses exponential backoff retry (max 5 attempts, 2s base). Messages are acknowledged after max retries to avoid infinite loops.

---

## Integration Auth Methods

| Service | Auth Method |
|---|---|
| NetSuite | OAuth 1.0a TBA (HMAC-SHA256 signed header per request) |
| Acrobat Sign | OAuth 2.0 refresh token (access token cached, refreshed 60s before expiry) |
| DocuSign | JWT Grant with RSA private key (legacy/backup path) |
| SendGrid | API key (Bearer token) |
| AWS | IAM credentials via env vars (use IAM roles in prod) |

**Webhook verification:**
- DocuSign: HMAC-SHA256 (`X-DocuSign-Signature-1` header)
- Acrobat Sign: client ID echo only (no signature verification yet)

---

## Error Handling Pattern

- All integrations retry up to 5x with exponential backoff via `withRetry()`
- Webhook handlers always return `200` even on processing errors (prevents vendor retries)
- Form submission validates server-side and returns `422` with missing field list
- Rate limit: 5 submissions/hour per IP on `/api/submit`

---

## Key Environment Variables

See `.env.example` for full list. Key groups:

- `DB_*` / `DATABASE_URL` — PostgreSQL connection
- `AWS_*`, `S3_BUCKET`, `SQS_QUEUE_URL` — AWS services
- `NETSUITE_*` — account ID, OAuth 1.0a credentials, subsidiary/employee IDs
- `ACROBAT_*` — client credentials, refresh token, NDA template ID
- `DOCUSIGN_*` — legacy signing path
- `SENDGRID_*` — API key, from address, template IDs
- `PCS_OPS_EMAIL`, `PCS_LEGAL_EMAIL` — internal routing
