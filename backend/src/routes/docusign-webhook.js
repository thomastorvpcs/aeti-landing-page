const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const { enqueue } = require("../services/queue");

const router = express.Router();

const HMAC_SECRET = process.env.DOCUSIGN_HMAC_SECRET;

/**
 * Verify DocuSign Connect HMAC-SHA256 signature.
 * DocuSign sends the signature in X-DocuSign-Signature-1 header.
 */
function verifyHmac(rawBody, signature) {
  if (!HMAC_SECRET) {
    console.warn("DOCUSIGN_HMAC_SECRET not set — skipping HMAC verification (dev only)");
    return true;
  }
  const computed = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(rawBody)
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature || ""));
}

// Parse raw body for HMAC verification (must come before express.json middleware)
router.use(
  express.raw({ type: "application/json", limit: "2mb" })
);

router.post("/", async (req, res) => {
  const signature = req.headers["x-docusign-signature-1"];
  const rawBody = req.body; // Buffer from express.raw

  if (!verifyHmac(rawBody, signature)) {
    console.warn("DocuSign webhook: invalid HMAC signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { event, data } = payload;
  if (!data?.envelopeId) {
    return res.status(400).json({ error: "Missing envelopeId" });
  }

  const envelopeId = data.envelopeId;

  // We only care about fully completed envelopes
  if (event !== "envelope-completed") {
    return res.status(200).json({ received: true });
  }

  try {
    // Look up the reseller by envelope ID
    const result = await pool.query(
      "SELECT id, contact_email, contact_first_name, contact_last_name, legal_company_name, address_city, address_state FROM resellers WHERE docusign_envelope_id = $1",
      [envelopeId]
    );

    if (result.rows.length === 0) {
      console.warn(`DocuSign webhook: no reseller found for envelope ${envelopeId}`);
      return res.status(200).json({ received: true });
    }

    const reseller = result.rows[0];

    // Update status to NDA Complete
    await pool.query(
      "UPDATE resellers SET status = $1, signed_at = NOW() WHERE id = $2",
      ["NDA Complete", reseller.id]
    );

    // Enqueue downstream: download signed NDA, archive to S3, update NetSuite, send email
    await enqueue("NDA_COMPLETED", {
      resellerId: reseller.id,
      envelopeId,
      contactEmail: reseller.contact_email,
      contactFirstName: reseller.contact_first_name,
      contactLastName: reseller.contact_last_name,
      legalCompanyName: reseller.legal_company_name,
    });

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("DocuSign webhook processing error:", err);
    // Still return 200 to prevent DocuSign from retrying
    return res.status(200).json({ received: true, error: "Internal error queued for retry" });
  }
});

module.exports = router;
