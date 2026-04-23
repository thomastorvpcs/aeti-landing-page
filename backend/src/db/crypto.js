const { createHmac } = require("crypto");

function encryptionKey() {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (!key) throw new Error("DB_ENCRYPTION_KEY env var is not set");
  return key;
}

// Deterministic HMAC of a normalised EIN — used for the unique index so that
// ON CONFLICT dedup works even though pgp_sym_encrypt is non-deterministic.
function einHmac(ein) {
  return createHmac("sha256", encryptionKey())
    .update(ein.toLowerCase().trim())
    .digest("hex");
}

// SQL fragment that SELECTs all reseller columns with the three encrypted fields
// decrypted inline.  keyParam is the query-parameter placeholder for the
// encryption key (e.g. "$1", "$2"); whereClause is appended verbatim.
function selectResellerSql(keyParam, whereClause = "") {
  return `
    SELECT
      id, legal_company_name, dba,
      pgp_sym_decrypt(ein, ${keyParam})::text AS ein,
      ein_hmac, entity_type,
      address_street, address_city, address_state, address_zip, address_country,
      billing_address_street, billing_address_city, billing_address_state,
      billing_address_zip, billing_address_country,
      website,
      contact_first_name, contact_last_name, contact_title, contact_email, contact_phone,
      finance_contact_name, finance_contact_title, finance_contact_email, finance_contact_phone,
      bank_name, bank_address,
      pgp_sym_decrypt(bank_account_number, ${keyParam})::text AS bank_account_number,
      pgp_sym_decrypt(bank_aba, ${keyParam})::text AS bank_aba,
      bank_swift, w9_s3_key, bank_letter_s3_key, signed_nda_s3_key,
      docusign_envelope_id, netsuite_vendor_id, status,
      reseller_signed_at, signed_at,
      nda_signer_first_name, nda_signer_last_name, nda_signer_title, nda_signer_email, nda_signer_phone,
      created_at, updated_at
    FROM resellers ${whereClause}
  `;
}

module.exports = { encryptionKey, einHmac, selectResellerSql };
