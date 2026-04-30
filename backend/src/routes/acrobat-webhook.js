const crypto = require("crypto");
const express = require("express");
const pool = require("../db");
const { enqueue } = require("../services/queue");
const { getAgreementStatus } = require("../services/acrobat-sign");

const EXPECTED_CLIENT_ID = process.env.ACROBAT_CLIENT_ID;

// Compute expected fingerprint once at startup — ACROBAT_WEBHOOK_CERT is the public cert
// stored either as a base64-encoded PEM (preferred, avoids portal newline mangling) or as a
// PEM string with literal \n separators.
let _certRaw = process.env.ACROBAT_WEBHOOK_CERT || "";
if (_certRaw && !_certRaw.includes("-----BEGIN")) {
  _certRaw = Buffer.from(_certRaw, "base64").toString("utf8");
}
const certPem = _certRaw.replace(/\\n/g, "\n").trim();
const EXPECTED_FINGERPRINT = certPem
  ? new crypto.X509Certificate(certPem).fingerprint256
  : null;
if (EXPECTED_FINGERPRINT) {
  console.log("[acrobat-webhook] Client cert fingerprint loaded:", EXPECTED_FINGERPRINT);
}

// Verify the client certificate Adobe presents on every webhook call (two-way SSL).
// Azure App Service terminates TLS and injects the client cert as base64 DER in X-ARR-ClientCert.
function verifyClientCert(req, res, next) {
  const header = req.headers["x-arr-clientcert"];
  if (!header) {
    console.warn("[acrobat-webhook] Missing client certificate");
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const presented = new crypto.X509Certificate(Buffer.from(header, "base64"));
    if (presented.fingerprint256 !== EXPECTED_FINGERPRINT) {
      console.warn("[acrobat-webhook] Client certificate fingerprint mismatch");
      return res.status(401).json({ error: "Unauthorized" });
    }
  } catch (err) {
    console.error("[acrobat-webhook] Certificate parse error:", err.message);
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const router = express.Router();

/**
 * Acrobat Sign webhook verification.
 * Acrobat Sign sends a GET with X-AdobeSign-ClientId header during registration — no client cert.
 * Must respond 200 with the client ID in header AND body — but only if it matches our app.
 */
router.get("/", (req, res) => {
  const clientId = req.headers["x-adobesign-clientid"];
  if (!EXPECTED_CLIENT_ID || clientId !== EXPECTED_CLIENT_ID) {
    console.warn("[acrobat-webhook] GET verification rejected — client ID mismatch");
    return res.status(400).json({ error: "Client ID mismatch" });
  }
  res
    .status(200)
    .set("X-AdobeSign-ClientId", clientId)
    .json({ xAdobeSignClientId: clientId });
});

/**
 * Acrobat Sign webhook event handler.
 */
router.post("/", verifyClientCert, async (req, res) => {
  const clientId = req.headers["x-adobesign-clientid"];
  if (!EXPECTED_CLIENT_ID || clientId !== EXPECTED_CLIENT_ID) {
    console.warn("[acrobat-webhook] POST rejected — client ID mismatch");
    return res.status(401).json({ error: "Unauthorized" });
  }

  let payload;
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
    payload = JSON.parse(raw);
  } catch (e) {
    console.error("[acrobat-webhook] JSON parse error:", e.message);
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { event, agreement } = payload;
  const agreementId = agreement?.id;

  console.log("[acrobat-webhook] Received event:", event, "agreementId:", agreementId);

  // Acknowledge immediately — Acrobat Sign expects a fast 200
  res.status(200).json({ received: true });

  const agreementStatus = payload.agreement?.status;

  const isEsigned = event === "AGREEMENT_ACTION_COMPLETED" && payload.actionType === "ESIGNED";
  const isWorkflowComplete = event === "AGREEMENT_WORKFLOW_COMPLETED";

  if (!isEsigned && !isWorkflowComplete) {
    console.log(`[acrobat-webhook] Skipping event: ${event}, actionType: ${payload.actionType}`);
    return;
  }
  if (!agreementId) return;

  const isFullyComplete = isWorkflowComplete || agreementStatus === "SIGNED";

  try {
    const result = await pool.query(
      "SELECT id, status, contact_email, contact_first_name, contact_last_name, legal_company_name FROM resellers WHERE docusign_envelope_id = $1",
      [agreementId]
    );

    if (result.rows.length === 0) {
      console.warn(`[acrobat-webhook] No reseller found for agreement ${agreementId}`);
      return;
    }

    const reseller = result.rows[0];

    // If the payload doesn't confirm fully signed but the reseller is already awaiting
    // countersign, Legal just signed — confirm via API rather than trusting the payload status
    let fullyComplete = isFullyComplete;
    if (!fullyComplete && isEsigned && reseller.status === "Awaiting Countersign") {
      try {
        const liveStatus = await getAgreementStatus(agreementId);
        console.log(`[acrobat-webhook] Live agreement status for ${agreementId}: ${liveStatus}`);
        fullyComplete = liveStatus === "SIGNED";
      } catch (err) {
        console.error(`[acrobat-webhook] Could not fetch live agreement status:`, err.message);
      }
    }

    if (fullyComplete) {
      // Atomic update — only succeeds if not already processing or complete.
      // Prevents duplicate enqueues when two webhook events arrive simultaneously.
      const updated = await pool.query(
        "UPDATE resellers SET status = $1, signed_at = NOW() WHERE id = $2 AND status NOT IN ('NDA Processing', 'NDA Complete') RETURNING id",
        ["NDA Processing", reseller.id]
      );

      if (updated.rowCount === 0) {
        console.log(`[acrobat-webhook] Reseller ${reseller.id} already NDA Complete — skipping duplicate event`);
        return;
      }

      await enqueue("NDA_COMPLETED", {
        resellerId: reseller.id,
        envelopeId: agreementId,
        contactEmail: reseller.contact_email,
        contactFirstName: reseller.contact_first_name,
        contactLastName: reseller.contact_last_name,
        legalCompanyName: reseller.legal_company_name,
      });

      console.log(`[acrobat-webhook] NDA_COMPLETED enqueued for reseller ${reseller.id}`);
    } else {
      // Reseller has signed; PCS countersignature still pending
      await pool.query(
        "UPDATE resellers SET status = $1, reseller_signed_at = NOW() WHERE id = $2 AND status = 'NDA Pending'",
        ["Awaiting Countersign", reseller.id]
      );
      console.log(`[acrobat-webhook] Reseller ${reseller.id} signed — awaiting PCS countersignature`);
    }
  } catch (err) {
    console.error("[acrobat-webhook] Processing error:", err.message);
  }
});

module.exports = router;
