const express = require("express");
const pool = require("../db");
const { getPresignedUrl } = require("../services/s3");

const router = express.Router();

// Simple token auth — set DASHBOARD_SECRET in .env
router.use((req, res, next) => {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return next(); // no secret set → open in dev
  const auth = req.headers["x-dashboard-secret"];
  if (auth !== secret) return res.status(401).json({ error: "Unauthorized" });
  next();
});

router.get("/resellers", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        legal_company_name,
        dba,
        ein,
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
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/resellers/:id/files", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, w9_s3_key, bank_letter_s3_key FROM resellers WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const { id, w9_s3_key, bank_letter_s3_key } = rows[0];
    const vendorFormKey = `resellers/${id}/vendor_setup_form.pdf`;

    const [w9Url, bankLetterUrl, vendorFormUrl] = await Promise.all([
      w9_s3_key ? getPresignedUrl(w9_s3_key, 300) : null,
      bank_letter_s3_key ? getPresignedUrl(bank_letter_s3_key, 300) : null,
      getPresignedUrl(vendorFormKey, 300).catch(() => null),
    ]);

    res.json({ w9: w9Url, bankLetter: bankLetterUrl, vendorForm: vendorFormUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
