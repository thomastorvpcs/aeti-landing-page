const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const FROM_NAME = process.env.SENDGRID_FROM_NAME;
const SUPPORT_EMAIL = process.env.SENDGRID_SUPPORT_EMAIL;
const OPS_ALERT_EMAIL = process.env.PCS_OPS_EMAIL;

// Azure Key Vault references that fail to resolve are passed through as the raw
// "@Microsoft.KeyVault(...)" string, which is truthy but which SendGrid rejects as
// an invalid GUID. Validate at module load and treat anything malformed as unset.
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const _rawTemplateWelcome = process.env.SENDGRID_TEMPLATE_WELCOME;
const _rawTemplateWelcomeManual = process.env.SENDGRID_TEMPLATE_WELCOME_MANUAL;

const TEMPLATE_WELCOME = GUID_RE.test(_rawTemplateWelcome) ? _rawTemplateWelcome : null;
const TEMPLATE_WELCOME_MANUAL = GUID_RE.test(_rawTemplateWelcomeManual) ? _rawTemplateWelcomeManual : null;

if (_rawTemplateWelcome && !TEMPLATE_WELCOME)
  console.warn("[sendgrid] SENDGRID_TEMPLATE_WELCOME is not a valid GUID (unresolved Key Vault ref?) — falling back to plain-text email");
if (_rawTemplateWelcomeManual && !TEMPLATE_WELCOME_MANUAL)
  console.warn("[sendgrid] SENDGRID_TEMPLATE_WELCOME_MANUAL is not a valid GUID (unresolved Key Vault ref?)");

/**
 * Send the welcome email to the reseller once onboarding completes.
 * Attaches the signed NDA PDF (e-signed path only) and the program letter.
 *
 * @param {object} opts
 * @param {string} opts.to               - Reseller commercial contact email
 * @param {string} opts.firstName
 * @param {string} opts.lastName
 * @param {string} opts.legalCompanyName
 * @param {Buffer} [opts.signedNdaPdf]   - PDF buffer of the signed NDA; absent on the manual path
 * @param {Buffer} [opts.programLetterPdf] - PDF buffer of the program letter
 * @param {string} [opts.envelopeId]     - Acrobat Sign agreement id; absent on the manual path
 * @param {string} opts.netsuiteVendorId
 * @param {boolean} [opts.manual]        - NDA was handled outside Acrobat Sign
 */
async function sendWelcomeEmail({
  to,
  firstName,
  lastName,
  legalCompanyName,
  signedNdaPdf,
  programLetterPdf,
  envelopeId,
  netsuiteVendorId,
  manual,
}) {
  const attachments = [];

  if (signedNdaPdf) {
    attachments.push({
      content: signedNdaPdf.toString("base64"),
      filename: "ABTI_NDA_Signed.pdf",
      type: "application/pdf",
      disposition: "attachment",
    });
  }

  if (programLetterPdf) {
    attachments.push({
      content: programLetterPdf.toString("base64"),
      filename: "ABTI_Reseller_Program_Letter.pdf",
      type: "application/pdf",
      disposition: "attachment",
    });
  }

  const msg = {
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    attachments,
    customArgs: {
      acrobat_envelope_id: envelopeId || "",
      netsuite_vendor_id: netsuiteVendorId || "",
    },
  };

  // The manual path gets its own template — its copy must not thank the reseller for
  // signing an NDA that never went through Acrobat Sign. If the environment is
  // template-configured but the manual template is missing or malformed, fail loudly
  // rather than sending the e-sign copy with no NDA attached.
  if (manual && !TEMPLATE_WELCOME_MANUAL && TEMPLATE_WELCOME) {
    throw new Error(
      "SENDGRID_TEMPLATE_WELCOME_MANUAL is missing or not a valid GUID — refusing to send the manual welcome email with the e-sign template."
    );
  }

  const templateId = manual ? TEMPLATE_WELCOME_MANUAL : TEMPLATE_WELCOME;

  if (templateId) {
    msg.templateId = templateId;
    msg.dynamicTemplateData = {
      firstName,
      lastName,
      legalCompanyName,
      supportEmail: SUPPORT_EMAIL,
    };
  } else {
    const ndaLine = signedNdaPdf
      ? "Thank you for signing the NDA. Your signed agreement is attached."
      : "Thank you for completing your onboarding. Your reseller program letter is attached.";
    msg.subject = `Welcome to the AETI Reseller Program, ${firstName}!`;
    msg.text = `Hi ${firstName},\n\n${ndaLine}\n\nWelcome to the AETI Reseller Program!\n\nIf you have any questions, contact us at ${SUPPORT_EMAIL}.\n\nBest regards,\nPCS Partner Program`;
  }

  await sgMail.send(msg);
}

/**
 * Send an internal alert to PCS Operations on every new reseller submission.
 */
async function sendInternalAlert({
  legalCompanyName,
  contactEmail,
  contactFirstName,
  contactLastName,
  resellerId,
  note,
}) {
  const msg = {
    to: OPS_ALERT_EMAIL.split(",").map((e) => e.trim()),
    from: { email: FROM_EMAIL, name: FROM_NAME },
    customArgs: {
      reseller_id: resellerId,
    },
  };

  msg.subject = note || `New AETI reseller submission: ${legalCompanyName}`;
  msg.text = note
    ? `${note}\n\nReseller ID: ${resellerId}\nCompany: ${legalCompanyName}\nTimestamp: ${new Date().toISOString()}`
    : `A new reseller has submitted the onboarding form.\n\nCompany: ${legalCompanyName}\nContact: ${contactFirstName} ${contactLastName}\nEmail: ${contactEmail}\nReseller ID: ${resellerId}\nSubmitted: ${new Date().toISOString()}`;

  await sgMail.send(msg);
}

module.exports = { sendWelcomeEmail, sendInternalAlert };
