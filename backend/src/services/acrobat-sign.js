const axios = require("axios");

const CLIENT_ID = process.env.ACROBAT_CLIENT_ID;
const CLIENT_SECRET = process.env.ACROBAT_CLIENT_SECRET;
const API_BASE_URL = process.env.ACROBAT_API_BASE_URL || "https://api.na1.adobesign.com";
const NDA_TEMPLATE_ID = process.env.ACROBAT_NDA_TEMPLATE_ID;
const LEGAL_SIGNER_EMAIL = process.env.PCS_LEGAL_EMAIL;
const LEGAL_SIGNER_NAME = process.env.PCS_LEGAL_NAME || "PCS Legal";

let _cachedToken = null;
let _tokenExpiry = 0;

/**
 * Get a valid access token, refreshing if expired.
 */
async function getAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const refreshToken = process.env.ACROBAT_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("ACROBAT_REFRESH_TOKEN is not set");

  const response = await axios.post(
    `${API_BASE_URL}/oauth/v2/refresh`,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  _cachedToken = response.data.access_token;
  // expires_in is in seconds; refresh 60s early
  _tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
  return _cachedToken;
}

/**
 * Return an axios instance with Authorization header set.
 */
async function apiClient() {
  const token = await getAccessToken();
  return axios.create({
    baseURL: `${API_BASE_URL}/api/rest/v6`,
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Send the NDA agreement to the reseller (signer 1) and PCS Legal (signer 2).
 * Uses an Acrobat Sign Library Template.
 */
async function sendNdaAgreement({
  resellerId,
  legalCompanyName,
  contactEmail,
  contactFirstName,
  contactLastName,
  addressCity,
  addressState,
}) {
  const client = await apiClient();

  const today = new Date();
  const effectiveDay = today.getDate().toString();
  const effectiveMonth = today.toLocaleString("en-US", { month: "long" });

  const payload = {
    fileInfos: [{ libraryDocumentId: NDA_TEMPLATE_ID }],
    name: `PCS Reseller NDA — ${legalCompanyName}`,
    participantSetsInfo: [
      {
        memberInfos: [
          { email: contactEmail, name: `${contactFirstName} ${contactLastName}` },
        ],
        order: 1,
        role: "SIGNER",
        label: "Reseller",
      },
      {
        memberInfos: [{ email: LEGAL_SIGNER_EMAIL, name: LEGAL_SIGNER_NAME }],
        order: 2,
        role: "SIGNER",
        label: "PCSLegal",
      },
    ],
    signatureType: "ESIGN",
    state: "IN_PROCESS",
    mergeFieldInfo: [
      { fieldName: "LegalCompanyName", defaultValue: legalCompanyName },
      { fieldName: "CompanyAddress", defaultValue: `${addressCity}, ${addressState}` },
      { fieldName: "EffectiveDay", defaultValue: effectiveDay },
      { fieldName: "EffectiveMonth", defaultValue: effectiveMonth },
    ],
  };

  console.log("[acrobat] Creating agreement for:", legalCompanyName, contactEmail);

  const response = await client.post("/agreements", payload);
  return response.data.id;
}

/**
 * Download the completed signed NDA as a PDF buffer.
 */
async function downloadSignedNda(agreementId) {
  const client = await apiClient();

  const response = await client.get(
    `/agreements/${agreementId}/combinedDocument`,
    { responseType: "arraybuffer" }
  );

  return Buffer.from(response.data);
}

/**
 * Register a webhook on the Acrobat Sign account.
 * Call this once during setup — not on every request.
 */
async function registerWebhook(webhookUrl) {
  const client = await apiClient();

  const payload = {
    name: "AETI Onboarding Webhook",
    scope: "ACCOUNT",
    state: "ACTIVE",
    webhookSubscriptionEvents: ["AGREEMENT_WORKFLOW_COMPLETED"],
    webhookUrlInfo: { url: webhookUrl },
  };

  const response = await client.post("/webhooks", payload);
  console.log("[acrobat] Webhook registered:", response.data.id);
  return response.data.id;
}

async function getLibraryTemplates() {
  const client = await apiClient();
  const response = await client.get("/libraryDocuments");
  return response.data;
}

module.exports = { sendNdaAgreement, downloadSignedNda, registerWebhook, getLibraryTemplates };
