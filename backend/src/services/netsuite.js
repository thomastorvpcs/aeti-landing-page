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

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

function buildAuthHeader(method, url) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Parse query params from the URL — OAuth 1.0a requires them in the
  // signature parameter set, sorted together with the oauth_* params.
  const [baseUrl, queryString] = url.split("?");
  const queryParams = queryString
    ? queryString.split("&").map((p) => decodeURIComponent(p))
    : [];

  const allParams = [
    `oauth_consumer_key=${process.env.NETSUITE_CONSUMER_KEY}`,
    `oauth_nonce=${nonce}`,
    `oauth_signature_method=HMAC-SHA256`,
    `oauth_timestamp=${timestamp}`,
    `oauth_token=${process.env.NETSUITE_TOKEN_ID}`,
    `oauth_version=1.0`,
    ...queryParams,
  ].sort().join("&");

  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(baseUrl),
    encodeURIComponent(allParams),
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
    `oauth_signature="${signature}"`
  );
}

function restletRequest(body) {
  console.error("[netsuite] RESTLET_URL:", RESTLET_URL);
  console.error("[netsuite] ACCOUNT_ID_REALM:", ACCOUNT_ID_REALM);
  console.error("[netsuite] Consumer key (first 8):", process.env.NETSUITE_CONSUMER_KEY?.slice(0, 8));
  console.error("[netsuite] Token ID (first 8):", process.env.NETSUITE_TOKEN_ID?.slice(0, 8));
  const auth = buildAuthHeader("POST", RESTLET_URL);
  console.error("[netsuite] Auth header:", auth);
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

  // Only include fields that have a value — omit nulls so the Restlet
  // receives the same kind of payload as a fully-populated Postman request.
  const defined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ""));

  const payload = defined({
    legalCompanyName,
    dba,
    ein,
    entityType,
    addressStreet,
    addressCity,
    addressState: STATE_NAMES[addressState] || addressState,
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
  });

  console.error("[netsuite] createVendor payload:", JSON.stringify(payload, null, 2));

  const response = await restletRequest(payload);
  const data = response.data;

  if (!data.success) {
    const detail = data.fields ? `Missing fields: ${data.fields.join(", ")}` : data.error;
    throw new Error(`NetSuite Restlet error: ${detail}`);
  }

  if (!data.netsuiteRecordId) {
    throw new Error(`NetSuite Restlet succeeded but returned no netsuiteRecordId. Response: ${JSON.stringify(data)}`);
  }

  console.log("[netsuite] Vendor created, netsuiteRecordId:", data.netsuiteRecordId);
  return data.netsuiteRecordId;
}

/**
 * Update the onboarding status on an existing vendor via the Restlet.
 */
async function updateVendorStatus(netsuiteVendorId, status) {
  const response = await restletRequest({ action: "updateStatus", vendorId: netsuiteVendorId, status });
  const data = response.data;
  if (!data.success) {
    throw new Error(`NetSuite updateVendorStatus error: ${data.error}`);
  }
}

/**
 * Create a NetSuite Task assigned to a team member via the Restlet.
 */
async function createTask({ title, message, assigneeEmployeeId, relatedVendorId }) {
  const response = await restletRequest({ action: "createTask", title, message, assigneeEmployeeId, relatedVendorId });
  const data = response.data;
  if (!data.success) {
    throw new Error(`NetSuite createTask error: ${data.error}`);
  }
}

module.exports = {
  createVendor,
  updateVendorStatus,
  createTask,
};
