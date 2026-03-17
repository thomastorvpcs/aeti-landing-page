const docusign = require("docusign-esign");
const fs = require("fs");
const path = require("path");

const ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;
const INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const USER_ID = process.env.DOCUSIGN_USER_ID;
const PRIVATE_KEY_PATH = process.env.DOCUSIGN_PRIVATE_KEY_PATH || path.join(__dirname, "../../docusign.key");
const BASE_PATH = process.env.DOCUSIGN_BASE_PATH || "https://demo.docusign.net/restapi";
const LEGAL_SIGNER_EMAIL = process.env.PCS_LEGAL_EMAIL;
const LEGAL_SIGNER_NAME = process.env.PCS_LEGAL_NAME || "PCS Legal";
const NDA_TEMPLATE_ID = process.env.DOCUSIGN_NDA_TEMPLATE_ID;

let _cachedToken = null;
let _tokenExpiry = 0;

/**
 * Obtain a JWT access token via JWT Grant (server-to-server).
 */
async function getAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(BASE_PATH);

  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");

  const results = await apiClient.requestJWTUserToken(
    INTEGRATION_KEY,
    USER_ID,
    ["signature", "impersonation"],
    privateKey,
    3600
  );

  _cachedToken = results.body.access_token;
  _tokenExpiry = Date.now() + (results.body.expires_in - 60) * 1000;
  return _cachedToken;
}

/**
 * Create a DocuSign API client authenticated with a fresh JWT token.
 */
async function getApiClient() {
  const token = await getAccessToken();
  const client = new docusign.ApiClient();
  client.setBasePath(BASE_PATH);
  client.addDefaultHeader("Authorization", `Bearer ${token}`);
  return client;
}

/**
 * Send the NDA envelope to the reseller (signer 1) and PCS Legal (signer 2).
 *
 * Uses a pre-configured DocuSign template. Fields pre-filled via tabs.
 */
async function sendNdaEnvelope({ resellerId, legalCompanyName, contactEmail, contactFirstName, contactLastName, addressCity, addressState }) {
  const client = await getApiClient();
  const envelopesApi = new docusign.EnvelopesApi(client);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const envelopeDefinition = new docusign.EnvelopeDefinition();
  envelopeDefinition.templateId = NDA_TEMPLATE_ID;
  envelopeDefinition.status = "sent";

  // Signer 1: Reseller
  const resellerSigner = docusign.TemplateRole.constructFromObject({
    email: contactEmail,
    name: `${contactFirstName} ${contactLastName}`,
    roleName: "Reseller",
    routingOrder: "1",
    tabs: {
      textTabs: [
        { tabLabel: "LegalCompanyName", value: legalCompanyName },
        { tabLabel: "SignerCity", value: `${addressCity}, ${addressState}` },
        { tabLabel: "EffectiveDate", value: today },
      ],
    },
  });

  // Signer 2: PCS Legal (countersigner)
  const legalSigner = docusign.TemplateRole.constructFromObject({
    email: LEGAL_SIGNER_EMAIL,
    name: LEGAL_SIGNER_NAME,
    roleName: "PCSLegal",
    routingOrder: "2",
  });

  envelopeDefinition.templateRoles = [resellerSigner, legalSigner];

  // Custom metadata for tracking
  envelopeDefinition.customFields = docusign.CustomFields.constructFromObject({
    textCustomFields: [
      { name: "resellerId", value: resellerId, show: false, required: false },
    ],
  });

  const result = await envelopesApi.createEnvelope(ACCOUNT_ID, {
    envelopeDefinition,
  });

  return result.envelopeId;
}

/**
 * Download the completed, signed NDA PDF from DocuSign.
 */
async function downloadSignedNda(envelopeId) {
  const client = await getApiClient();
  const envelopesApi = new docusign.EnvelopesApi(client);

  // Get the list of documents in the envelope
  const docs = await envelopesApi.listDocuments(ACCOUNT_ID, envelopeId, {});
  const ndaDoc = docs.envelopeDocuments.find((d) => d.name.toLowerCase().includes("nda")) || docs.envelopeDocuments[0];

  const pdfBuffer = await envelopesApi.getDocument(
    ACCOUNT_ID,
    envelopeId,
    ndaDoc.documentId,
    {}
  );

  // docusign-esign returns a Buffer or ReadableStream depending on version
  if (Buffer.isBuffer(pdfBuffer)) return pdfBuffer;
  // Collect stream
  const chunks = [];
  for await (const chunk of pdfBuffer) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = { sendNdaEnvelope, downloadSignedNda };
