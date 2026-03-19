const axios = require("axios");
const crypto = require("crypto");

/**
 * NetSuite REST API integration.
 *
 * Authentication: OAuth 1.0a (Token-Based Authentication — TBA)
 * This is the standard pattern for NetSuite server-to-server integrations.
 *
 * Required env vars:
 *   NETSUITE_ACCOUNT_ID       — e.g. "1234567" (without -SB suffix for production)
 *   NETSUITE_CONSUMER_KEY
 *   NETSUITE_CONSUMER_SECRET
 *   NETSUITE_TOKEN_ID
 *   NETSUITE_TOKEN_SECRET
 *   NETSUITE_SUBSIDIARY_ID    — internal ID of the subsidiary for new vendors
 *   NETSUITE_LEGAL_EMPLOYEE_ID — internal ID of the legal employee for task assignment
 *   NETSUITE_FINANCE_EMPLOYEE_ID — internal ID of the finance employee for task assignment
 */

const ACCOUNT_ID = process.env.NETSUITE_ACCOUNT_ID;
// URL uses lowercase with dash (e.g. 4914507-sb1)
// OAuth realm uses uppercase with underscore (e.g. 4914507_SB1)
const ACCOUNT_ID_REALM = ACCOUNT_ID.replace(/-/g, "_").toUpperCase();
const BASE_URL = `https://${ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/record/v1`;

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

function nsRequest(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const auth = buildAuthHeader(method, url);
  console.log("[netsuite] ACCOUNT_ID:", ACCOUNT_ID);
  console.log("[netsuite] ACCOUNT_ID_REALM:", ACCOUNT_ID_REALM);
  console.log("[netsuite] URL:", url);
  console.log("[netsuite] Consumer Key (first 8):", process.env.NETSUITE_CONSUMER_KEY?.slice(0, 8));
  console.log("[netsuite] Token ID (first 8):", process.env.NETSUITE_TOKEN_ID?.slice(0, 8));
  const headers = {
    Authorization: auth,
    "Content-Type": "application/json",
    Prefer: "return-minimal",
  };
  return axios({ method, url, headers, data: body });
}

/**
 * Create a NetSuite Vendor record.
 * EIN is used as externalId for idempotency — safe to retry.
 */
async function createVendor(reseller) {
  const {
    ein,
    legalCompanyName,
    entityType,
    addressStreet,
    addressCity,
    addressState,
    addressZip,
    contactEmail,
    contactPhone,
    contactFirstName,
    contactLastName,
  } = reseller;

  console.log("[netsuite] createVendor fields:", { ein, legalCompanyName, addressStreet, addressCity, addressState, addressZip });

  const body = {
    externalId: ein,
    companyName: legalCompanyName,
    subsidiary: { id: process.env.NETSUITE_SUBSIDIARY_ID },
    isPerson: false,
    email: contactEmail,
    phone: contactPhone,
    custentity_onboarding_status: "Initiated",
    // Address subrecord
    addressbook: {
      items: [
        {
          defaultBilling: true,
          defaultShipping: true,
          label: "Primary",
          addressbookaddress: {
            addr1: addressStreet,
            city: addressCity,
            state: addressState,
            zip: addressZip,
            country: "US",
            attention: `${contactFirstName} ${contactLastName}`,
          },
        },
      ],
    },
  };

  const response = await nsRequest("POST", "/vendor", body);
  // NetSuite returns the internal ID in the Location header: .../vendor/{internalId}
  const location = response.headers.location || "";
  const internalId = location.split("/").pop();
  return internalId;
}

/**
 * Update the custentity_onboarding_status field on an existing vendor.
 */
async function updateVendorStatus(netsuiteVendorId, status) {
  await nsRequest("PATCH", `/vendor/${netsuiteVendorId}`, {
    custentity_onboarding_status: status,
  });
}

/**
 * Attach a document to the vendor record via the NetSuite File Cabinet.
 * `fileBuffer` is a Buffer, `fileName` is the display name.
 */
async function attachFileToVendor({ netsuiteVendorId, folderInternalId, fileName, fileBuffer, mimeType }) {
  // Step 1: Upload file to File Cabinet
  const fileBase64 = fileBuffer.toString("base64");
  const fileRes = await nsRequest("POST", "/file", {
    name: fileName,
    fileType: mimeType === "application/pdf" ? "_PDF_" : "_IMAGE_",
    content: fileBase64,
    folder: { id: folderInternalId || process.env.NETSUITE_FILE_CABINET_FOLDER_ID },
  });
  const fileLocation = fileRes.headers.location || "";
  const fileId = fileLocation.split("/").pop();

  // Step 2: Link the file to the vendor via a vendor attachment
  await nsRequest("POST", `/vendor/${netsuiteVendorId}/!attachments`, {
    attachFrom: "RECORD",
    record: { type: "file", id: fileId },
  });

  return fileId;
}

/**
 * Create a NetSuite Task assigned to a team member.
 */
async function createTask({ title, message, assigneeEmployeeId, relatedVendorId }) {
  await nsRequest("POST", "/task", {
    title,
    message,
    assigned: { id: assigneeEmployeeId },
    company: { id: relatedVendorId },
    status: "NOTSTARTED",
    priority: "HIGH",
  });
}

module.exports = {
  createVendor,
  updateVendorStatus,
  attachFileToVendor,
  createTask,
};
