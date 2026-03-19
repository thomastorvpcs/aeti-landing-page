const express = require("express");
const { v4: uuidv4 } = require("uuid");
const upload = require("../middleware/upload");
const pool = require("../db");
const { uploadFile } = require("../services/s3");
const { enqueue } = require("../services/queue");

const router = express.Router();

router.post("/", upload.fields([{ name: "w9", maxCount: 1 }, { name: "bankLetter", maxCount: 1 }]), async (req, res, next) => {
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
      addressCountry,
      website,
      billingAddressStreet,
      billingAddressCity,
      billingAddressState,
      billingAddressZip,
      billingAddressCountry,
      contactFirstName,
      contactLastName,
      contactTitle,
      contactEmail,
      contactPhone,
      financeContactName,
      financeContactTitle,
      financeContactEmail,
      financeContactPhone,
      bankName,
      bankAddress,
      bankAccountNumber,
      bankAba,
      bankSwift,
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
      financeContactName,
      financeContactEmail,
      financeContactPhone,
      bankName,
      bankAccountNumber,
      bankAba,
    };

    const missing = Object.entries(required)
      .filter(([, v]) => !v || !String(v).trim())
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(422).json({ error: "Missing required fields.", fields: missing });
    }

    const w9FileUpload = req.files?.w9?.[0];
    const bankLetterUpload = req.files?.bankLetter?.[0];

    if (!w9FileUpload) {
      return res.status(422).json({ error: "W-9 document is required." });
    }
    if (!bankLetterUpload) {
      return res.status(422).json({ error: "Bank letter is required." });
    }

    // Reuse existing ID if this EIN has already been submitted, so S3 keys stay consistent
    const existing = await pool.query("SELECT id FROM resellers WHERE ein = $1", [ein.trim()]);
    const resellerId = existing.rows[0]?.id || uuidv4();

    const w9Ext = w9FileUpload.originalname.split(".").pop();
    const w9Key = `resellers/${resellerId}/w9.${w9Ext}`;
    const bankLetterExt = bankLetterUpload.originalname.split(".").pop();
    const bankLetterKey = `resellers/${resellerId}/bank_letter.${bankLetterExt}`;

    // Upload W-9 and bank letter to S3
    await uploadFile({
      key: w9Key,
      buffer: w9FileUpload.buffer,
      contentType: w9FileUpload.mimetype,
    });
    await uploadFile({
      key: bankLetterKey,
      buffer: bankLetterUpload.buffer,
      contentType: bankLetterUpload.mimetype,
    });

    // Persist to PostgreSQL
    // EIN stored as-is here; add pgcrypto encryption in production via DB function or KMS
    const result = await pool.query(
      `INSERT INTO resellers (
        id, legal_company_name, dba, ein, entity_type,
        address_street, address_city, address_state, address_zip, address_country,
        billing_address_street, billing_address_city, billing_address_state, billing_address_zip, billing_address_country,
        website,
        contact_first_name, contact_last_name, contact_title,
        contact_email, contact_phone,
        finance_contact_name, finance_contact_title, finance_contact_email, finance_contact_phone,
        bank_name, bank_address, bank_account_number, bank_aba, bank_swift,
        w9_s3_key, bank_letter_s3_key, status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33
      )
      ON CONFLICT (ein) DO UPDATE SET
        legal_company_name    = EXCLUDED.legal_company_name,
        w9_s3_key             = EXCLUDED.w9_s3_key,
        bank_letter_s3_key    = EXCLUDED.bank_letter_s3_key,
        updated_at            = NOW()
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
        addressCountry?.trim() || null,
        billingAddressStreet?.trim() || null,
        billingAddressCity?.trim() || null,
        billingAddressState?.trim() || null,
        billingAddressZip?.trim() || null,
        billingAddressCountry?.trim() || null,
        website?.trim() || null,
        contactFirstName.trim(),
        contactLastName.trim(),
        contactTitle?.trim() || null,
        contactEmail.trim().toLowerCase(),
        contactPhone.trim(),
        financeContactName.trim(),
        financeContactTitle?.trim() || null,
        financeContactEmail.trim().toLowerCase(),
        financeContactPhone.trim(),
        bankName.trim(),
        bankAddress?.trim() || null,
        bankAccountNumber.trim(),
        bankAba.trim(),
        bankSwift?.trim() || null,
        w9Key,
        bankLetterKey,
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
