require("dotenv").config();

// ─── Required environment variables ───────────────────────────────────────────
const REQUIRED_ENV = [
  "DB_ENCRYPTION_KEY",
  "AZURE_STORAGE_CONNECTION_STRING",
  "AZURE_SERVICE_BUS_CONNECTION_STRING",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "ACROBAT_CLIENT_ID",
  "NETSUITE_RESTLET_URL",
];

const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  console.error("[startup] Missing required environment variables:", missingEnv.join(", "));
  process.exit(1);
}
if (process.env.DB_ENCRYPTION_KEY.length < 32) {
  console.error("[startup] DB_ENCRYPTION_KEY must be at least 32 characters");
  process.exit(1);
}
console.log("[startup] Environment variables OK");

const http = require("http");
const pool = require("../db");
const { encryptionKey, selectResellerSql } = require("../db/crypto");
const { subscribe, enqueue } = require("../services/queue");
const { uploadFile, downloadFile } = require("../services/storage");
const { downloadSignedNda, getAgreementStatus, hasResellerSigned } = require("../services/acrobat-sign");
const { createVendor } = require("../services/netsuite");
const { sendWelcomeEmail, sendInternalAlert } = require("../services/sendgrid");
const { generateAuthorizationLetter, generateVendorSetupForm } = require("../services/pdf");

const MAX_RETRIES = 5;
const RETRY_BASE_MS = 2000; // exponential backoff base

/**
 * Sleep for ms milliseconds.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry an async function with exponential backoff.
 */
async function withRetry(fn, label) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      const msg = err.message;
      if (attempt === MAX_RETRIES) {
        console.error(`[worker] ${label} failed after ${MAX_RETRIES} attempts: status=${status ?? "none"} msg=${msg}`);
        throw err;
      }
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(`[worker] ${label} attempt ${attempt} failed: status=${status ?? "none"} msg=${msg}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

// ─── Job handlers ──────────────────────────────────────────────────────────────

/**
 * RESELLER_SUBMITTED
 * Triggered immediately after form submission.
 * - Create NetSuite vendor record
 * - Send DocuSign NDA envelope
 * - Send internal ops alert via SendGrid
 * - Update DB with NS vendor ID and DS envelope ID
 */
async function handleResellerSubmitted(payload) {
  const { resellerId, legalCompanyName, contactEmail, contactFirstName, contactLastName, ein,
          ndaSignerFirstName, ndaSignerLastName, ndaSignerEmail, w9Key, bankLetterKey } = payload;

  // Fetch full reseller record from DB with sensitive fields decrypted
  const key = encryptionKey();
  const { rows } = await pool.query(selectResellerSql("$2", "WHERE id = $1"), [resellerId, key]);
  if (!rows.length) throw new Error(`Reseller ${resellerId} not found`);
  const reseller = rows[0];

  // 1. Generate and upload vendor setup form PDF to Azure Blob Storage
  const vendorFormPdf = await withRetry(
    () => generateVendorSetupForm(reseller),
    "generateVendorSetupForm"
  );
  const vendorFormKey = `resellers/${resellerId}/vendor_setup_form.pdf`;
  await withRetry(
    () => uploadFile({ key: vendorFormKey, buffer: vendorFormPdf, contentType: "application/pdf" }),
    "uploadFile(vendorSetupForm)"
  );
  console.log(`[worker] Vendor setup form uploaded: ${vendorFormKey}`);

  // Download files from blob storage and encode as base64 for direct RESTlet upload
  const [w9Buffer, bankLetterBuffer, vendorSetupFormBuffer] = await Promise.all([
    w9Key ? withRetry(() => downloadFile(w9Key), "downloadFile(w9)") : null,
    bankLetterKey ? withRetry(() => downloadFile(bankLetterKey), "downloadFile(bankLetter)") : null,
    withRetry(() => downloadFile(vendorFormKey), "downloadFile(vendorSetupForm)"),
  ]);

  // 2. Create NetSuite vendor via Restlet
  const netsuiteVendorId = await withRetry(
    () => createVendor({
      resellerId,
      legalCompanyName,
      dba: reseller.dba,
      ein,
      entityType: reseller.entity_type,
      addressStreet: reseller.address_street,
      addressCity: reseller.address_city,
      addressState: reseller.address_state,
      addressZip: reseller.address_zip,
      contactFirstName,
      contactLastName,
      contactTitle: reseller.contact_title,
      contactEmail,
      contactPhone: reseller.contact_phone,
      ndaSignerFirstName: reseller.nda_signer_first_name,
      ndaSignerLastName: reseller.nda_signer_last_name,
      ndaSignerTitle: reseller.nda_signer_title,
      ndaSignerEmail: reseller.nda_signer_email,
      ndaSignerPhone: reseller.nda_signer_phone,
      financeContactName: reseller.finance_contact_name,
      financeContactEmail: reseller.finance_contact_email,
      financeContactPhone: reseller.finance_contact_phone,
      bankName: reseller.bank_name,
      bankAba: reseller.bank_aba,
      bankAccountNumber: reseller.bank_account_number,
      bankSwift: reseller.bank_swift,
      submissionDate: reseller.created_at?.toISOString().slice(0, 10),
      w9Buffer,
      w9FileName: 'w9.pdf',
      bankLetterBuffer,
      bankLetterFileName: 'bank_letter.pdf',
      vendorSetupFormBuffer,
      vendorSetupFormFileName: 'vendor_setup_form.pdf',
    }),
    "NetSuite createVendor"
  );

  // 4. Update DB — hold at "NDA Approval Pending" until a dashboard user approves and sends the NDA
  await pool.query(
    "UPDATE resellers SET netsuite_vendor_id = $1, status = $2, updated_at = NOW() WHERE id = $3",
    [netsuiteVendorId, "NDA Approval Pending", resellerId]
  );

  // 5. Send internal ops alert — prompts the team to review the submission in the dashboard
  await withRetry(
    () => sendInternalAlert({ legalCompanyName, contactEmail, contactFirstName, contactLastName, ein, resellerId }),
    "SendGrid sendInternalAlert"
  );

  console.log(`[worker] RESELLER_SUBMITTED processed: reseller=${resellerId} ns=${netsuiteVendorId} — awaiting NDA approval`);
}

/**
 * NDA_COMPLETED
 * Triggered by Acrobat Sign webhook or polling when agreement is fully signed.
 * - Download signed NDA PDF from Acrobat Sign
 * - Archive to Azure Blob Storage
 * - Update status to "NDA Complete"
 * - Send welcome email with signed NDA + authorization letter
 */
async function handleNdaCompleted(payload) {
  const { resellerId, envelopeId, contactEmail, contactFirstName, contactLastName, legalCompanyName } = payload;

  // Fetch reseller with sensitive fields decrypted
  const key = encryptionKey();
  const { rows } = await pool.query(selectResellerSql("$2", "WHERE id = $1"), [resellerId, key]);
  if (!rows.length) throw new Error(`Reseller ${resellerId} not found`);
  const reseller = rows[0];

  // Idempotency guard — if the signed NDA is already uploaded a previous job
  // completed successfully. Skip to avoid sending duplicate welcome emails.
  if (reseller.signed_nda_s3_key) {
    console.log(`[worker] NDA_COMPLETED already processed for reseller=${resellerId} — skipping duplicate job`);
    return;
  }

  // 1. Download signed NDA from Acrobat Sign.
  // Wait 20s first — Acrobat Sign needs time to finalise the combined document
  // after the workflow-completed event before it's available for download.
  console.log("[worker] Waiting 20s for Acrobat Sign to finalise combined document...");
  await sleep(20000);
  const signedNdaPdf = await withRetry(
    () => downloadSignedNda(envelopeId),
    "Acrobat Sign downloadSignedNda"
  );

  // 2. Archive to Azure Blob Storage
  const ndaKey = `resellers/${resellerId}/signed_nda.pdf`;
  await withRetry(
    () => uploadFile({ key: ndaKey, buffer: signedNdaPdf, contentType: "application/pdf" }),
    "uploadFile(signedNda)"
  );

  // 3. Update DB with NDA blob key and advance status to NDA Complete
  await pool.query(
    "UPDATE resellers SET signed_nda_s3_key = $1, status = 'NDA Complete', updated_at = NOW() WHERE id = $2",
    [ndaKey, resellerId]
  );

  // 4. Generate authorization letter
  const programLetterPdf = await withRetry(
    () => generateAuthorizationLetter({ legalCompanyName }),
    "generateAuthorizationLetter"
  );

  // 5. Send welcome email with signed NDA and authorization letter attached
  await withRetry(
    () => sendWelcomeEmail({
      to: contactEmail,
      firstName: contactFirstName,
      lastName: contactLastName,
      legalCompanyName,
      signedNdaPdf,
      programLetterPdf,
      ein: reseller.ein,
      envelopeId,
      netsuiteVendorId: reseller.netsuite_vendor_id,
    }),
    "SendGrid sendWelcomeEmail"
  );

  console.log(`[worker] NDA_COMPLETED processed: reseller=${resellerId}`);
}

// ─── Agreement status polling ───────────────────────────────────────────────────

/**
 * Poll all NDA Pending resellers and process any whose agreement is now SIGNED.
 * Runs every 5 minutes as a fallback when the webhook misses the final signing event.
 */
async function pollPendingAgreements() {
  const { rows } = await pool.query(
    `SELECT id, docusign_envelope_id, contact_email, contact_first_name, contact_last_name, legal_company_name
     FROM resellers WHERE status IN ('NDA Pending', 'Awaiting Countersign') AND docusign_envelope_id IS NOT NULL`
  );

  if (rows.length === 0) return;
  console.log(`[worker] Polling ${rows.length} pending agreement(s)...`);

  for (const reseller of rows) {
    try {
      const status = await getAgreementStatus(reseller.docusign_envelope_id);
      console.log(`[worker] Agreement ${reseller.docusign_envelope_id} status: ${status}`);

      if (status === "CANCELLED" || status === "RECALLED") {
        await pool.query("UPDATE resellers SET status = $1 WHERE id = $2", ["Cancelled", reseller.id]);
        console.log(`[worker] Agreement cancelled, marking reseller ${reseller.id} as Cancelled`);
        continue;
      }

      if (status === "SIGNED") {
        await pool.query(
          "UPDATE resellers SET status = $1, signed_at = NOW() WHERE id = $2 AND status NOT IN ('NDA Processing', 'NDA Complete')",
          ["NDA Processing", reseller.id]
        );
        await enqueue("NDA_COMPLETED", {
          resellerId: reseller.id,
          envelopeId: reseller.docusign_envelope_id,
          contactEmail: reseller.contact_email,
          contactFirstName: reseller.contact_first_name,
          contactLastName: reseller.contact_last_name,
          legalCompanyName: reseller.legal_company_name,
        });
        console.log(`[worker] Polled NDA_COMPLETED enqueued for reseller ${reseller.id}`);
        continue;
      }

      // Webhook missed: reseller signed but DB still shows "NDA Pending".
      // Confirm via the /members endpoint — check if Reseller (order 1) has COMPLETED.
      if (status === "OUT_FOR_SIGNATURE" && reseller.status === "NDA Pending") {
        const resellerSigned = await hasResellerSigned(reseller.docusign_envelope_id);
        if (resellerSigned) {
          await pool.query(
            "UPDATE resellers SET status = $1, reseller_signed_at = NOW() WHERE id = $2 AND status = 'NDA Pending'",
            ["Awaiting Countersign", reseller.id]
          );
          console.log(`[worker] Missed webhook recovered — reseller ${reseller.id} signed, status → Awaiting Countersign`);
        }
      }
    } catch (err) {
      if (err.response?.status === 404) {
        await pool.query("UPDATE resellers SET status = $1 WHERE id = $2", ["Cancelled", reseller.id]);
        console.warn(`[worker] Agreement not found (404), marking reseller ${reseller.id} as Cancelled`);
      } else {
        console.error(`[worker] Poll check failed for reseller ${reseller.id}:`, err.message);
      }
    }
  }
}

// ─── Stuck submission polling ───────────────────────────────────────────────────

/**
 * Poll for resellers stuck in "Initiated" for more than 2 minutes.
 * These are form submissions whose RESELLER_SUBMITTED job was never picked up
 * by the push subscription. Re-enqueuing ensures they are always processed
 * even when the Service Bus push subscription silently drops.
 */
async function pollStuckSubmissions() {
  const key = encryptionKey();
  const { rows } = await pool.query(
    `SELECT id, legal_company_name, contact_email, contact_first_name, contact_last_name,
            pgp_sym_decrypt(ein, $1)::text AS ein,
            nda_signer_first_name, nda_signer_last_name, nda_signer_email
     FROM resellers
     WHERE status = 'Initiated' AND created_at < NOW() - INTERVAL '2 minutes'`,
    [key]
  );

  console.log(`[worker] pollStuckSubmissions: ${rows.length} stuck record(s)`);
  if (rows.length === 0) return;
  console.log(`[worker] Found ${rows.length} stuck submission(s) — re-enqueuing...`);

  for (const reseller of rows) {
    try {
      await enqueue("RESELLER_SUBMITTED", {
        resellerId: reseller.id,
        legalCompanyName: reseller.legal_company_name,
        contactEmail: reseller.contact_email,
        contactFirstName: reseller.contact_first_name,
        contactLastName: reseller.contact_last_name,
        ein: reseller.ein,
        ndaSignerFirstName: reseller.nda_signer_first_name,
        ndaSignerLastName: reseller.nda_signer_last_name,
        ndaSignerEmail: reseller.nda_signer_email,
      });
      console.log(`[worker] Re-enqueued RESELLER_SUBMITTED for stuck reseller=${reseller.id}`);
    } catch (err) {
      console.error(`[worker] Failed to re-enqueue reseller ${reseller.id}:`, err.message);
    }
  }
}

// ─── Main polling loop ──────────────────────────────────────────────────────────

async function run() {
  // Verify DB is reachable before subscribing to the queue
  try {
    await pool.query("SELECT 1");
    console.log("[startup] Database connection OK");
  } catch (err) {
    console.error("[startup] Database connection failed:", err.message);
    process.exit(1);
  }

  console.log("[worker] Onboarding worker started. Subscribing to Service Bus queue...");

  // Poll Acrobat Sign every 5 minutes as fallback for missed webhook events
  pollPendingAgreements().catch(console.error);
  setInterval(() => pollPendingAgreements().catch(console.error), 5 * 60 * 1000);

  // Poll for stuck submissions every 10 minutes as fallback for dropped push subscriptions
  pollStuckSubmissions().catch(console.error);
  setInterval(() => pollStuckSubmissions().catch(console.error), 10 * 60 * 1000);

  subscribe(
    async (body, ack) => {
      const { type, payload } = body;
      console.log(`[worker] Processing job: ${type}`);
      try {
        switch (type) {
          case "RESELLER_SUBMITTED":
            await handleResellerSubmitted(payload);
            break;
          case "NDA_COMPLETED":
            await handleNdaCompleted(payload);
            break;
          default:
            console.warn(`[worker] Unknown job type: ${type}`);
        }
        await ack();
        console.log("[worker] Job completed and acknowledged.");
      } catch (err) {
        console.error(`[worker] Job ${type} failed:`, err.message);
        if (type === "NDA_COMPLETED") {
          // Alert ops so the welcome email can be manually re-triggered from the dashboard
          sendInternalAlert({
            legalCompanyName: payload.legalCompanyName || "Unknown",
            resellerId: payload.resellerId,
            note: `NDA_COMPLETED job failed for reseller ${payload.resellerId} (${payload.legalCompanyName}) — welcome email was NOT sent. Use the dashboard to re-trigger. Error: ${err.message}`,
          }).catch((alertErr) => {
            console.error("[worker] Failed to send internal alert:", alertErr.message);
          });
        }
        // Acknowledge to prevent infinite retry loop — Service Bus dead-letters after max delivery count
        await ack();
      }
    },
    async (err) => {
      console.error("[worker] Service Bus error:", err.message);
    }
  ).catch((err) => {
    console.error("[worker] Service Bus polling loop exited unexpectedly:", err.message);
    process.exit(1);
  });
}

// Health check server — keeps Azure App Service from treating the worker
// as a crashed app due to no HTTP listener on the expected port.
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", worker: "onboarding-worker" }));
}).listen(PORT, () => {
  console.log(`[worker] Health check server listening on port ${PORT}`);
});

run().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("[shutdown] SIGTERM received — draining DB pool and exiting");
  pool.end()
    .then(() => { console.log("[shutdown] Graceful shutdown complete"); process.exit(0); })
    .catch(() => process.exit(1));
  setTimeout(() => { console.warn("[shutdown] Forced exit after timeout"); process.exit(0); }, 10000).unref();
});

// Catch AMQP/Service Bus timeout errors and other unhandled exceptions
// so the process exits cleanly and Azure restarts it automatically.
process.on("uncaughtException", (err) => {
  console.error("[worker] Uncaught exception — exiting for restart:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[worker] Unhandled rejection — exiting for restart:", reason);
  process.exit(1);
});
