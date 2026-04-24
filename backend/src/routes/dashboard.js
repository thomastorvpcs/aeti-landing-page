const express = require("express");
const pool = require("../db");
const { encryptionKey } = require("../db/crypto");
const { getPresignedUrl, blobExists, deleteFolder } = require("../services/storage");
const { sendReminder, cancelAgreement, sendNdaAgreement } = require("../services/acrobat-sign");
const { enqueue } = require("../services/queue");
const requireDashboardAuth = require("../middleware/requireDashboardAuth");
const { dashboardActionRateLimiter } = require("../middleware/rate-limit");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router = express.Router();

router.use(requireDashboardAuth);

// Reject any route with a non-UUID :id before it reaches the handler
router.param("id", (req, res, next, id) => {
  if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid ID format" });
  next();
});

async function auditLog({ action, resellerId, resellerName, performedBy, details }) {
  try {
    await pool.query(
      "INSERT INTO audit_log (action, reseller_id, reseller_name, performed_by, details) VALUES ($1, $2, $3, $4, $5)",
      [action, resellerId || null, resellerName || null, performedBy, details || null]
    );
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err.message);
  }
}

router.get("/resellers", async (_req, res, next) => {
  try {
    const key = encryptionKey();
    const { rows } = await pool.query(
      `SELECT
        id,
        legal_company_name,
        dba,
        pgp_sym_decrypt(ein, $1)::text AS ein,
        entity_type,
        address_city,
        address_state,
        contact_first_name,
        contact_last_name,
        contact_email,
        contact_phone,
        nda_signer_first_name,
        nda_signer_last_name,
        nda_signer_email,
        netsuite_vendor_id,
        docusign_envelope_id,
        status,
        reseller_signed_at,
        signed_at,
        created_at,
        updated_at
      FROM resellers
      ORDER BY created_at DESC`,
      [key]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/audit-log", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, action, reseller_id, reseller_name, performed_by, details, created_at
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/resellers/:id/files", dashboardActionRateLimiter, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, legal_company_name, w9_s3_key, bank_letter_s3_key, signed_nda_s3_key FROM resellers WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const { id, legal_company_name, w9_s3_key, bank_letter_s3_key, signed_nda_s3_key } = rows[0];
    const vendorFormKey = `resellers/${id}/vendor_setup_form.pdf`;

    const [w9Url, bankLetterUrl, vendorFormUrl, signedNdaUrl] = await Promise.all([
      w9_s3_key ? getPresignedUrl(w9_s3_key, 300) : null,
      bank_letter_s3_key ? getPresignedUrl(bank_letter_s3_key, 300) : null,
      blobExists(vendorFormKey).then((exists) => exists ? getPresignedUrl(vendorFormKey, 300) : null),
      signed_nda_s3_key ? getPresignedUrl(signed_nda_s3_key, 300) : null,
    ]);

    await auditLog({
      action: "Files accessed",
      resellerId: id,
      resellerName: legal_company_name,
      performedBy: req.dashboardUser.email,
    });

    res.json({ w9: w9Url, bankLetter: bankLetterUrl, vendorForm: vendorFormUrl, signedNda: signedNdaUrl });
  } catch (err) {
    next(err);
  }
});

router.post("/resellers/:id/send-nda", dashboardActionRateLimiter, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM resellers WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Reseller not found" });

    const reseller = rows[0];

    if (reseller.status !== "NDA Approval Pending") {
      return res.status(400).json({
        error: `Cannot send NDA — expected status "NDA Approval Pending", got "${reseller.status}".`,
      });
    }

    const envelopeId = await sendNdaAgreement({
      resellerId: reseller.id,
      legalCompanyName: reseller.legal_company_name,
      contactEmail: reseller.nda_signer_email || reseller.contact_email,
      contactFirstName: reseller.nda_signer_first_name || reseller.contact_first_name,
      contactLastName: reseller.nda_signer_last_name || reseller.contact_last_name,
      contactTitle: reseller.nda_signer_title || reseller.contact_title,
      addressCity: reseller.address_city,
      addressState: reseller.address_state,
    });

    await pool.query(
      "UPDATE resellers SET docusign_envelope_id = $1, status = $2, updated_at = NOW() WHERE id = $3",
      [envelopeId, "NDA Pending", reseller.id]
    );

    await auditLog({
      action: "NDA approved and sent",
      resellerId: reseller.id,
      resellerName: reseller.legal_company_name,
      performedBy: req.dashboardUser.email,
      details: `Envelope ${envelopeId}`,
    });

    console.log(`[dashboard] NDA approved and sent: reseller=${reseller.id} envelope=${envelopeId} by=${req.dashboardUser.email}`);
    res.json({ sent: true, envelopeId });
  } catch (err) {
    next(err);
  }
});

router.post("/resellers/:id/resend-nda", dashboardActionRateLimiter, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, legal_company_name, status, docusign_envelope_id FROM resellers WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Reseller not found" });

    const { id, legal_company_name, status, docusign_envelope_id: agreementId } = rows[0];

    if (!agreementId) {
      return res.status(400).json({ error: "No Acrobat Sign agreement on record for this reseller." });
    }

    if (status === "NDA Pending") {
      await sendReminder(agreementId, "Reseller");
      await auditLog({
        action: "NDA reminder sent to reseller",
        resellerId: id,
        resellerName: legal_company_name,
        performedBy: req.dashboardUser.email,
      });
      return res.json({ sent: true, to: "reseller" });
    }

    if (status === "Awaiting Countersign") {
      await sendReminder(agreementId, "PCSLegal");
      await auditLog({
        action: "NDA reminder sent to legal",
        resellerId: id,
        resellerName: legal_company_name,
        performedBy: req.dashboardUser.email,
      });
      return res.json({ sent: true, to: "legal" });
    }

    return res.status(400).json({ error: `Cannot resend NDA in status "${status}".` });
  } catch (err) {
    next(err);
  }
});

router.post("/resellers/:id/cancel-nda", dashboardActionRateLimiter, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, legal_company_name, status, docusign_envelope_id FROM resellers WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Reseller not found" });

    const { id, legal_company_name, status, docusign_envelope_id: agreementId } = rows[0];

    if (status !== "NDA Pending" && status !== "Awaiting Countersign") {
      return res.status(400).json({ error: `Cannot cancel NDA in status "${status}".` });
    }

    if (agreementId) {
      await cancelAgreement(agreementId);
    }

    await pool.query(
      "UPDATE resellers SET status = 'Cancelled', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    await auditLog({
      action: "NDA cancelled",
      resellerId: id,
      resellerName: legal_company_name,
      performedBy: req.dashboardUser.email,
    });

    res.json({ cancelled: true });
  } catch (err) {
    next(err);
  }
});

router.post("/resellers/:id/retry-completion", dashboardActionRateLimiter, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, status, docusign_envelope_id, contact_email, contact_first_name, contact_last_name, legal_company_name FROM resellers WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Reseller not found" });

    const reseller = rows[0];
    if (reseller.status !== "NDA Complete" && reseller.status !== "NDA Processing") {
      return res.status(400).json({ error: `Cannot retry completion — status is "${reseller.status}", expected "NDA Complete" or "NDA Processing".` });
    }
    if (!reseller.docusign_envelope_id) {
      return res.status(400).json({ error: "No agreement ID on record for this reseller." });
    }

    await enqueue("NDA_COMPLETED", {
      resellerId: reseller.id,
      envelopeId: reseller.docusign_envelope_id,
      contactEmail: reseller.contact_email,
      contactFirstName: reseller.contact_first_name,
      contactLastName: reseller.contact_last_name,
      legalCompanyName: reseller.legal_company_name,
    });

    await auditLog({
      action: "Welcome email retry queued",
      resellerId: reseller.id,
      resellerName: reseller.legal_company_name,
      performedBy: req.dashboardUser.email,
    });

    console.log(`[dashboard] NDA_COMPLETED re-enqueued for reseller=${reseller.id} by=${req.dashboardUser.email}`);
    res.json({ queued: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/resellers/:id", dashboardActionRateLimiter, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, legal_company_name, status FROM resellers WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Reseller not found" });

    const { id, legal_company_name, status } = rows[0];

    if (!["Cancelled", "Initiated", "NDA Approval Pending"].includes(status)) {
      return res.status(400).json({ error: "Only cancelled, initiated, or approval-pending resellers can be deleted." });
    }

    await deleteFolder(`resellers/${id}/`);
    await pool.query("DELETE FROM resellers WHERE id = $1", [id]);

    await auditLog({
      action: "Reseller deleted",
      resellerId: null,
      resellerName: legal_company_name,
      performedBy: req.dashboardUser.email,
      details: `Previous status: ${status}`,
    });

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
