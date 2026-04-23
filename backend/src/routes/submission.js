const express = require("express");
const { v4: uuidv4 } = require("uuid");
const upload = require("../middleware/upload");
const pool = require("../db");
const { encryptionKey, einHmac } = require("../db/crypto");
const { uploadFile } = require("../services/storage");
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
      ndaSignerSameAsContact,
      ndaSignerFirstName,
      ndaSignerLastName,
      ndaSignerTitle,
      ndaSignerEmail,
      ndaSignerPhone,
    } = req.body;

    // Resolve the actual NDA signer — fall back to commercial contact when same
    const ndaSame = ndaSignerSameAsContact === "true" || ndaSignerSameAsContact === true;
    const resolvedNdaFirstName = ndaSame ? contactFirstName : ndaSignerFirstName;
    const resolvedNdaLastName  = ndaSame ? contactLastName  : ndaSignerLastName;
    const resolvedNdaEmail     = ndaSame ? contactEmail     : ndaSignerEmail;
    const resolvedNdaPhone     = ndaSame ? contactPhone     : ndaSignerPhone;
    const resolvedNdaTitle     = ndaSame ? (contactTitle || null) : (ndaSignerTitle || null);

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

    // Reuse existing ID if this EIN has already been submitted, so storage keys stay consistent
    const existing = await pool.query("SELECT id FROM resellers WHERE ein_hmac = $1", [einHmac(ein.trim())]);
    const resellerId = existing.rows[0]?.id || uuidv4();

    const w9Ext = w9FileUpload.originalname.split(".").pop();
    const w9Key = `resellers/${resellerId}/w9.${w9Ext}`;
    const bankLetterExt = bankLetterUpload.originalname.split(".").pop();
    const bankLetterKey = `resellers/${resellerId}/bank_letter.${bankLetterExt}`;

    // Upload W-9 and bank letter to Azure Blob Storage
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

    // Persist to PostgreSQL — EIN, bank account number, and ABA are encrypted
    // at rest via pgcrypto pgp_sym_encrypt.  EIN also has a deterministic HMAC
    // column (ein_hmac) used for the unique index and ON CONFLICT dedup.
    const result = await pool.query(
      `INSERT INTO resellers (
        id, legal_company_name, dba, ein, ein_hmac, entity_type,
        address_street, address_city, address_state, address_zip, address_country,
        billing_address_street, billing_address_city, billing_address_state, billing_address_zip, billing_address_country,
        website,
        contact_first_name, contact_last_name, contact_title,
        contact_email, contact_phone,
        finance_contact_name, finance_contact_title, finance_contact_email, finance_contact_phone,
        bank_name, bank_address, bank_account_number, bank_aba, bank_swift,
        w9_s3_key, bank_letter_s3_key, status,
        nda_signer_first_name, nda_signer_last_name, nda_signer_title,
        nda_signer_email, nda_signer_phone
      ) VALUES (
        $1, $2, $3,
        pgp_sym_encrypt($4, $39), $5,
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26,
        $27, $28, pgp_sym_encrypt($29, $39), pgp_sym_encrypt($30, $39), $31,
        $32, $33, 'Initiated',
        $34, $35, $36, $37, $38
      )
      ON CONFLICT (ein_hmac) DO UPDATE SET
        legal_company_name    = EXCLUDED.legal_company_name,
        ein                   = EXCLUDED.ein,
        w9_s3_key             = EXCLUDED.w9_s3_key,
        bank_letter_s3_key    = EXCLUDED.bank_letter_s3_key,
        nda_signer_first_name = EXCLUDED.nda_signer_first_name,
        nda_signer_last_name  = EXCLUDED.nda_signer_last_name,
        nda_signer_title      = EXCLUDED.nda_signer_title,
        nda_signer_email      = EXCLUDED.nda_signer_email,
        nda_signer_phone      = EXCLUDED.nda_signer_phone,
        updated_at            = NOW()
      RETURNING id, status`,
      [
        resellerId,              // $1
        legalCompanyName.trim(), // $2
        dba?.trim() || null,     // $3
        ein.trim(),              // $4  — plaintext; SQL wraps in pgp_sym_encrypt($4, $39)
        einHmac(ein.trim()),     // $5  — deterministic HMAC for unique index
        entityType,              // $6
        addressStreet.trim(),    // $7
        addressCity.trim(),      // $8
        addressState,            // $9
        addressZip.trim(),       // $10
        addressCountry?.trim() || null,          // $11
        billingAddressStreet?.trim() || null,    // $12
        billingAddressCity?.trim() || null,      // $13
        billingAddressState?.trim() || null,     // $14
        billingAddressZip?.trim() || null,       // $15
        billingAddressCountry?.trim() || null,   // $16
        website?.trim() || null,                 // $17
        contactFirstName.trim(),                 // $18
        contactLastName.trim(),                  // $19
        contactTitle?.trim() || null,            // $20
        contactEmail.trim().toLowerCase(),       // $21
        contactPhone.trim(),                     // $22
        financeContactName.trim(),               // $23
        financeContactTitle?.trim() || null,     // $24
        financeContactEmail.trim().toLowerCase(), // $25
        financeContactPhone.trim(),              // $26
        bankName.trim(),                         // $27
        bankAddress?.trim() || null,             // $28
        bankAccountNumber.trim(),                // $29 — plaintext; SQL wraps in pgp_sym_encrypt($29, $39)
        bankAba.trim(),                          // $30 — plaintext; SQL wraps in pgp_sym_encrypt($30, $39)
        bankSwift?.trim() || null,               // $31
        w9Key,                                   // $32
        bankLetterKey,                           // $33
        resolvedNdaFirstName.trim(),             // $34
        resolvedNdaLastName.trim(),              // $35
        resolvedNdaTitle,                        // $36
        resolvedNdaEmail.trim().toLowerCase(),   // $37
        resolvedNdaPhone.trim(),                 // $38
        encryptionKey(),                         // $39 — pgcrypto key
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
      bankLetterKey,
      ndaSignerFirstName: resolvedNdaFirstName.trim(),
      ndaSignerLastName: resolvedNdaLastName.trim(),
      ndaSignerEmail: resolvedNdaEmail.trim().toLowerCase(),
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
