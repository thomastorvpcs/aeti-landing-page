const express = require("express");
const pool = require("../db");
const { getPresignedUrl } = require("../services/s3");
const requireDashboardAuth = require("../middleware/requireDashboardAuth");

const router = express.Router();

router.use(requireDashboardAuth);

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
      "SELECT id, w9_s3_key, bank_letter_s3_key, signed_nda_s3_key FROM resellers WHERE id = $1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const { id, w9_s3_key, bank_letter_s3_key, signed_nda_s3_key } = rows[0];
    const vendorFormKey = `resellers/${id}/vendor_setup_form.pdf`;

    const [w9Url, bankLetterUrl, vendorFormUrl, signedNdaUrl] = await Promise.all([
      w9_s3_key ? getPresignedUrl(w9_s3_key, 300) : null,
      bank_letter_s3_key ? getPresignedUrl(bank_letter_s3_key, 300) : null,
      getPresignedUrl(vendorFormKey, 300).catch(() => null),
      signed_nda_s3_key ? getPresignedUrl(signed_nda_s3_key, 300) : null,
    ]);

    res.json({ w9: w9Url, bankLetter: bankLetterUrl, vendorForm: vendorFormUrl, signedNda: signedNdaUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
