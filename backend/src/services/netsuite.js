const axios = require("axios");
const crypto = require("crypto");

/**
 * NetSuite Restlet integration.
 *
 * Authentication: OAuth 1.0a (Token-Based Authentication — TBA)
 *
 * Required env vars:
 *   NETSUITE_ACCOUNT_ID       — e.g. "1234567" (used for OAuth realm only)
 *   NETSUITE_CONSUMER_KEY
 *   NETSUITE_CONSUMER_SECRET
 *   NETSUITE_TOKEN_ID
 *   NETSUITE_TOKEN_SECRET
 *   NETSUITE_RESTLET_URL      — deployed Restlet script URL
 */

const ACCOUNT_ID = process.env.NETSUITE_ACCOUNT_ID;
const ACCOUNT_ID_REALM = ACCOUNT_ID?.replace(/-/g, "_").toUpperCase();
const RESTLET_URL = process.env.NETSUITE_RESTLET_URL;

function buildAuthHeader(method, url) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url.split("?")[0]),
    encodeURIComponent(
      [
        `oauth_consumer_key=${process.env.NETSUITE_CONSUMER_KEY}`,
        `oauth_nonce=${nonce}`,
        `oauth_signature_method=HMAC-SHA256`,
        `oauth_timestamp=${timestamp}`,
        `oauth_token=${process.env.NETSUITE_TOKEN_ID}`,
        `oauth_version=1.0`,
      ]
        .sort()
        .join("&")
    ),
  ].join("&");

  const signingKey = `${encodeURIComponent(process.env.NETSUITE_CONSUMER_SECRET)}&${encodeURIComponent(process.env.NETSUITE_TOKEN_SECRET)}`;

  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(signatureBaseString)
    .digest("base64");

  return (
    `OAuth realm="${ACCOUNT_ID_REALM}",` +
    `oauth_consumer_key="${process.env.NETSUITE_CONSUMER_KEY}",` +
    `oauth_token="${process.env.NETSUITE_TOKEN_ID}",` +
    `oauth_signature_method="HMAC-SHA256",` +
    `oauth_timestamp="${timestamp}",` +
    `oauth_nonce="${nonce}",` +
    `oauth_version="1.0",` +
    `oauth_signature="${encodeURIComponent(signature)}"`
  );
}

function restletRequest(body) {
  const auth = buildAuthHeader("POST", RESTLET_URL);
  return axios.post(RESTLET_URL, body, {
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Create a NetSuite Vendor record via the Restlet.
 * Returns the NetSuite internal vendor ID from the response.
 * The Restlet is expected to return JSON with a vendorId or internalId field.
 */
async function createVendor(reseller) {
  const {
    resellerId,
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
    ndaSignerFirstName,
    ndaSignerLastName,
    ndaSignerTitle,
    ndaSignerEmail,
    ndaSignerPhone,
    financeContactName,
    financeContactEmail,
    financeContactPhone,
    bankName,
    bankAba,
    bankAccountNumber,
    bankSwift,
    submissionDate,
  } = reseller;

  const payload = {
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
    ndaSignerFirstName,
    ndaSignerLastName,
    ndaSignerTitle,
    ndaSignerEmail,
    ndaSignerPhone,
    financeContactName,
    financeContactEmail,
    financeContactPhone,
    bankName,
    bankAba,
    bankAccountNumber,
    bankSwift,
    portalResellerId: resellerId,
    submissionDate,
  };

  console.log("[netsuite] createVendor:", legalCompanyName, ein);

  const response = await restletRequest(payload);
  const data = response.data;

  // Restlet should return { vendorId: "..." } or { internalId: "..." }
  const internalId = data.vendorId || data.internalId;
  if (!internalId) {
    throw new Error(`NetSuite Restlet did not return a vendor ID. Response: ${JSON.stringify(data)}`);
  }

  console.log("[netsuite] Vendor created, internalId:", internalId);
  return internalId;
}

/**
 * Update the onboarding status on an existing vendor via the Restlet.
 */
async function updateVendorStatus(netsuiteVendorId, status) {
  await restletRequest({ action: "updateStatus", vendorId: netsuiteVendorId, status });
}

/**
 * Create a NetSuite Task assigned to a team member via the Restlet.
 */
async function createTask({ title, message, assigneeEmployeeId, relatedVendorId }) {
  await restletRequest({ action: "createTask", title, message, assigneeEmployeeId, relatedVendorId });
}

module.exports = {
  createVendor,
  updateVendorStatus,
  createTask,
};
