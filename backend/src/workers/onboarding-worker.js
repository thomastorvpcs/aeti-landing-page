require("dotenv").config();

const pool = require("../db");
const { receive, ack, enqueue } = require("../services/queue");
const { uploadFile, downloadFile } = require("../services/s3");
const { sendNdaAgreement, downloadSignedNda, getAgreementStatus } = require("../services/acrobat-sign");
const { createVendor, updateVendorStatus, attachFileToVendor, createTask } = require("../services/netsuite");
const { sendWelcomeEmail, sendInternalAlert } = require("../services/sendgrid");

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
      const detail = err.response?.body || err.response?.data || err.message;
      if (attempt === MAX_RETRIES) {
        console.error(`[worker] ${label} failed after ${MAX_RETRIES} attempts:`, JSON.stringify(detail));
        throw err;
      }
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(`[worker] ${label} attempt ${attempt} failed. Retrying in ${delay}ms...`, JSON.stringify(detail));
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
  const { resellerId, legalCompanyName, contactEmail, contactFirstName, contactLastName, ein, w9Key } = payload;

  // Fetch full reseller record from DB
  const { rows } = await pool.query("SELECT * FROM resellers WHERE id = $1", [resellerId]);
  if (!rows.length) throw new Error(`Reseller ${resellerId} not found`);
  const reseller = rows[0];

  // 1. Create NetSuite vendor (skip if credentials not configured)
  let netsuiteVendorId = null;
  if (process.env.NETSUITE_ACCOUNT_ID) {
    netsuiteVendorId = await withRetry(
      () => createVendor({
        ein,
        legalCompanyName,
        entityType: reseller.entity_type,
        addressStreet: reseller.address_street,
        addressCity: reseller.address_city,
        addressState: reseller.address_state,
        addressZip: reseller.address_zip,
        contactEmail,
        contactPhone: reseller.contact_phone,
        contactFirstName,
        contactLastName,
      }),
      "NetSuite createVendor"
    );

    // 2. Attach W-9 to NetSuite vendor
    const w9Buffer = await withRetry(() => downloadFile(w9Key), "S3 downloadFile(w9)");
    await withRetry(
      () => attachFileToVendor({
        netsuiteVendorId,
        fileName: `W9_${legalCompanyName.replace(/\s+/g, "_")}.pdf`,
        fileBuffer: w9Buffer,
        mimeType: "application/pdf",
      }),
      "NetSuite attachW9"
    );

    // 3. Create NetSuite Task for Finance
    await withRetry(
      () => createTask({
        title: `New reseller submission: ${legalCompanyName}`,
        message: `Reseller ${legalCompanyName} (EIN: ${ein}) has submitted the onboarding form. W-9 attached. Please confirm banking details.`,
        assigneeEmployeeId: process.env.NETSUITE_FINANCE_EMPLOYEE_ID,
        relatedVendorId: netsuiteVendorId,
      }),
      "NetSuite createTask(finance)"
    );
  } else {
    console.warn("[worker] NETSUITE_ACCOUNT_ID not set — skipping NetSuite steps");
  }

  // 4. Send Acrobat Sign NDA
  const envelopeId = await withRetry(
    () => sendNdaAgreement({
      resellerId,
      legalCompanyName,
      contactEmail,
      contactFirstName,
      contactLastName,
      addressCity: reseller.address_city,
      addressState: reseller.address_state,
    }),
    "AcrobatSign sendNdaAgreement"
  );

  // 5. Update DB with integration IDs
  await pool.query(
    "UPDATE resellers SET netsuite_vendor_id = $1, docusign_envelope_id = $2, status = $3 WHERE id = $4",
    [netsuiteVendorId, envelopeId, "NDA Pending", resellerId]
  );

  // 6. Send internal ops alert
  await withRetry(
    () => sendInternalAlert({ legalCompanyName, contactEmail, contactFirstName, contactLastName, ein, resellerId }),
    "SendGrid sendInternalAlert"
  );

  console.log(`[worker] RESELLER_SUBMITTED processed: reseller=${resellerId} ns=${netsuiteVendorId} ds=${envelopeId}`);
}

/**
 * NDA_COMPLETED
 * Triggered by DocuSign webhook when envelope is fully signed.
 * - Download signed NDA PDF from DocuSign
 * - Archive to S3
 * - Attach to NetSuite vendor record
 * - Create NetSuite Task for Legal
 * - Update status to "NDA Complete"
 * - Send welcome email with signed NDA + program letter
 */
async function handleNdaCompleted(payload) {
  const { resellerId, envelopeId, contactEmail, contactFirstName, contactLastName, legalCompanyName } = payload;

  // Fetch reseller
  const { rows } = await pool.query("SELECT * FROM resellers WHERE id = $1", [resellerId]);
  if (!rows.length) throw new Error(`Reseller ${resellerId} not found`);
  const reseller = rows[0];

  // 1. Download signed NDA from DocuSign
  const signedNdaPdf = await withRetry(
    () => downloadSignedNda(envelopeId),
    "DocuSign downloadSignedNda"
  );

  // 2. Archive to S3
  const ndaKey = `resellers/${resellerId}/signed_nda.pdf`;
  await withRetry(
    () => uploadFile({ key: ndaKey, buffer: signedNdaPdf, contentType: "application/pdf" }),
    "S3 uploadFile(signedNda)"
  );

  // 3. Update DB with NDA S3 key
  await pool.query(
    "UPDATE resellers SET signed_nda_s3_key = $1 WHERE id = $2",
    [ndaKey, resellerId]
  );

  // 4. Attach signed NDA to NetSuite vendor
  if (reseller.netsuite_vendor_id) {
    await withRetry(
      () => attachFileToVendor({
        netsuiteVendorId: reseller.netsuite_vendor_id,
        fileName: `Signed_NDA_${legalCompanyName.replace(/\s+/g, "_")}.pdf`,
        fileBuffer: signedNdaPdf,
        mimeType: "application/pdf",
      }),
      "NetSuite attachSignedNda"
    );

    // 5. Update NetSuite vendor status
    await withRetry(
      () => updateVendorStatus(reseller.netsuite_vendor_id, "NDA Complete"),
      "NetSuite updateVendorStatus(NDA Complete)"
    );

    // 6. Create NetSuite Task for Legal to countersign / confirm
    await withRetry(
      () => createTask({
        title: `NDA signed by reseller: ${legalCompanyName}`,
        message: `${contactFirstName} ${contactLastName} has signed the NDA for ${legalCompanyName}. Please countersign in DocuSign (envelope: ${envelopeId}) and confirm completion.`,
        assigneeEmployeeId: process.env.NETSUITE_LEGAL_EMPLOYEE_ID,
        relatedVendorId: reseller.netsuite_vendor_id,
      }),
      "NetSuite createTask(legal)"
    );
  }

  // 7. Send welcome email with signed NDA attached
  await withRetry(
    () => sendWelcomeEmail({
      to: contactEmail,
      firstName: contactFirstName,
      lastName: contactLastName,
      legalCompanyName,
      signedNdaPdf,
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
     FROM resellers WHERE status = 'NDA Pending' AND docusign_envelope_id IS NOT NULL`
  );

  if (rows.length === 0) return;
  console.log(`[worker] Polling ${rows.length} pending agreement(s)...`);

  for (const reseller of rows) {
    try {
      const status = await getAgreementStatus(reseller.docusign_envelope_id);
      console.log(`[worker] Agreement ${reseller.docusign_envelope_id} status: ${status}`);

      if (status === "SIGNED") {
        await pool.query(
          "UPDATE resellers SET status = $1, signed_at = NOW() WHERE id = $2",
          ["NDA Complete", reseller.id]
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
      }
    } catch (err) {
      console.error(`[worker] Poll check failed for reseller ${reseller.id}:`, err.message);
    }
  }
}

// ─── Main polling loop ──────────────────────────────────────────────────────────

async function processMessage(msg) {
  const { type, payload } = msg.body;
  console.log(`[worker] Processing job: ${type}`);

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
}

async function run() {
  console.log("[worker] Onboarding worker started. Polling SQS...");

  // Poll Acrobat Sign every 5 minutes as fallback for missed webhook events
  pollPendingAgreements().catch(console.error);
  setInterval(() => pollPendingAgreements().catch(console.error), 5 * 60 * 1000);

  while (true) {
    let msg = null;
    try {
      msg = await receive();
      if (!msg) continue; // long-poll returned empty

      await processMessage(msg);
      await ack(msg.receiptHandle);
      console.log("[worker] Job completed and acknowledged.");
    } catch (err) {
      console.error("[worker] Unhandled error:", err.message);
      // Acknowledge the message to prevent infinite retry loop.
      // In production, route failed messages to a dead-letter queue instead.
      if (msg) {
        console.error("[worker] Acknowledging failed message to prevent retry loop.");
        await ack(msg.receiptHandle);
      }
    }
  }
}

run().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
