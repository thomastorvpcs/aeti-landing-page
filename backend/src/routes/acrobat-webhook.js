const express = require("express");
const pool = require("../db");
const { enqueue } = require("../services/queue");
const { getAgreementStatus } = require("../services/acrobat-sign");

const router = express.Router();


/**
 * Acrobat Sign webhook verification.
 * Acrobat Sign sends a GET with X-AdobeSign-ClientId header.
 * Must respond 200 with the client ID in header AND body.
 */
router.get("/", (req, res) => {
  const clientId = req.headers["x-adobesign-clientid"];
  console.log("[acrobat-webhook] GET verification received, clientId:", clientId);
  // Echo back whatever client ID Acrobat Sign sends
  res
    .status(200)
    .set("X-AdobeSign-ClientId", clientId)
    .json({ xAdobeSignClientId: clientId });
});

/**
 * Acrobat Sign webhook event handler.
 */
router.post("/", async (req, res) => {
  console.log("[acrobat-webhook] POST received, headers:", JSON.stringify(req.headers));

  const clientId = req.headers["x-adobesign-clientid"];
  console.log("[acrobat-webhook] POST client ID:", clientId);
  console.log("[acrobat-webhook] body type:", typeof req.body, "isBuffer:", Buffer.isBuffer(req.body), "length:", req.body?.length);

  let payload;
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
    console.log("[acrobat-webhook] raw body:", raw);
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
  console.log(`[acrobat-webhook] Agreement status: ${agreementStatus}`);

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
      // Atomic update — only succeeds if status is not already NDA Complete.
      // Prevents duplicate enqueues when two webhook events arrive simultaneously.
      const updated = await pool.query(
        "UPDATE resellers SET status = $1, signed_at = NOW() WHERE id = $2 AND status != 'NDA Complete' RETURNING id",
        ["NDA Complete", reseller.id]
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
