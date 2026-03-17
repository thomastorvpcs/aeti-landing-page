const express = require("express");
const { v4: uuidv4 } = require("uuid");
const upload = require("../middleware/upload");
const pool = require("../db");
const { uploadFile } = require("../services/s3");
const { enqueue } = require("../services/queue");

const router = express.Router();

router.post("/", upload.single("w9"), async (req, res, next) => {
  try {
    const {
      legalCompanyName,
      dba,
      ein,
      entityType,
      addressStreet,
      addressCity,
      addressState,
      addressZip,
      contactFirstName,
      contactLastName,
      contactTitle,
      contactEmail,
      contactPhone,
      apName,
      apEmail,
      apPhone,
    } = req.body;

    // Basic server-side validation
    const required = {
      legalCompanyName,
      ein,
      entityType,
      addressStreet,
      addressCity,
      addressState,
      addressZip,
      contactFirstName,
      contactLastName,
      contactEmail,
      contactPhone,
    };

    const missing = Object.entries(required)
      .filter(([, v]) => !v || !String(v).trim())
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(422).json({ error: "Missing required fields.", fields: missing });
    }

    if (!req.file) {
      return res.status(422).json({ error: "W-9 document is required." });
    }

    const resellerId = uuidv4();
    const ext = req.file.originalname.split(".").pop();
    const w9Key = `resellers/${resellerId}/w9.${ext}`;

    // Upload W-9 to S3
    await uploadFile({
      key: w9Key,
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
    });

    // Persist to PostgreSQL
    // EIN stored as-is here; add pgcrypto encryption in production via DB function or KMS
    const result = await pool.query(
      `INSERT INTO resellers (
        id, legal_company_name, dba, ein, entity_type,
        address_street, address_city, address_state, address_zip,
        contact_first_name, contact_last_name, contact_title,
        contact_email, contact_phone,
        ap_name, ap_email, ap_phone,
        w9_s3_key, status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      ON CONFLICT (ein) DO UPDATE SET
        legal_company_name  = EXCLUDED.legal_company_name,
        updated_at          = NOW()
      RETURNING id, status`,
      [
        resellerId,
        legalCompanyName.trim(),
        dba?.trim() || null,
        ein.trim(),
        entityType,
        addressStreet.trim(),
        addressCity.trim(),
        addressState,
        addressZip.trim(),
        contactFirstName.trim(),
        contactLastName.trim(),
        contactTitle?.trim() || null,
        contactEmail.trim().toLowerCase(),
        contactPhone.trim(),
        apName?.trim() || null,
        apEmail?.trim().toLowerCase() || null,
        apPhone?.trim() || null,
        w9Key,
        "Initiated",
      ]
    );

    const dbReseller = result.rows[0];

    // Enqueue async downstream work (DocuSign, NetSuite, SendGrid alerts)
    await enqueue("RESELLER_SUBMITTED", {
      resellerId: dbReseller.id,
      legalCompanyName,
      contactEmail,
      contactFirstName,
      contactLastName,
      ein,
      w9Key,
    });

    // Respond 202 immediately — downstream processing is async
    return res.status(202).json({
      message: "Application received. You will receive an NDA via email shortly.",
      resellerId: dbReseller.id,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
