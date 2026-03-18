const express = require("express");
const pool = require("../db");
const { enqueue } = require("../services/queue");

const router = express.Router();

const CLIENT_ID = process.env.ACROBAT_CLIENT_ID;

// Parse raw body so we can inspect headers before parsing JSON
router.use(express.raw({ type: "*/*", limit: "2mb" }));

/**
 * Acrobat Sign webhook verification.
 * When you register a webhook, Acrobat Sign sends a GET (or POST with no body)
 * containing X-AdobeSign-ClientId. Respond with 200 and echo the header back.
 */
router.get("/", (req, res) => {
  const clientId = req.headers["x-adobesign-clientid"];
  if (clientId !== CLIENT_ID) {
    console.warn("[acrobat-webhook] Verification failed — client ID mismatch");
    return res.status(400).send("Invalid client ID");
  }
  res.set("X-AdobeSign-ClientId", CLIENT_ID).status(200).send("OK");
});

router.post("/", async (req, res) => {
  console.log("[acrobat-webhook] POST received, headers:", JSON.stringify(req.headers));
  // Verify the request is from Acrobat Sign
  const clientId = req.headers["x-adobesign-clientid"];
  if (CLIENT_ID && clientId !== CLIENT_ID) {
    console.warn("[acrobat-webhook] Invalid client ID in webhook POST");
    return res.status(401).json({ error: "Invalid client ID" });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { event, agreement } = payload;
  const agreementId = agreement?.id;

  console.log("[acrobat-webhook] Received event:", event, "agreementId:", agreementId);

  // Acknowledge immediately — Acrobat Sign expects a fast 200
  res.status(200).json({ received: true });

  // Only process fully completed agreements
  if (event !== "AGREEMENT_WORKFLOW_COMPLETED") return;
  if (!agreementId) return;

  try {
    const result = await pool.query(
      "SELECT id, contact_email, contact_first_name, contact_last_name, legal_company_name FROM resellers WHERE docusign_envelope_id = $1",
      [agreementId]
    );

    if (result.rows.length === 0) {
      console.warn(`[acrobat-webhook] No reseller found for agreement ${agreementId}`);
      return;
    }

    const reseller = result.rows[0];

    await pool.query(
      "UPDATE resellers SET status = $1, signed_at = NOW() WHERE id = $2",
      ["NDA Complete", reseller.id]
    );

    await enqueue("NDA_COMPLETED", {
      resellerId: reseller.id,
      envelopeId: agreementId,
      contactEmail: reseller.contact_email,
      contactFirstName: reseller.contact_first_name,
      contactLastName: reseller.contact_last_name,
      legalCompanyName: reseller.legal_company_name,
    });

    console.log(`[acrobat-webhook] NDA_COMPLETED enqueued for reseller ${reseller.id}`);
  } catch (err) {
    console.error("[acrobat-webhook] Processing error:", err.message);
  }
});

module.exports = router;
