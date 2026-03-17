const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "resellers@pcsww.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "PCS Partner Program";
const OPS_ALERT_EMAIL = process.env.PCS_OPS_EMAIL || "ops@pcsww.com";

const TEMPLATE_WELCOME = process.env.SENDGRID_TEMPLATE_WELCOME;
const TEMPLATE_INTERNAL_ALERT = process.env.SENDGRID_TEMPLATE_INTERNAL_ALERT;

/**
 * Send the welcome email to the reseller after the NDA is countersigned.
 * Attaches the signed NDA PDF and the program letter.
 *
 * @param {object} opts
 * @param {string} opts.to               - Reseller commercial contact email
 * @param {string} opts.firstName
 * @param {string} opts.lastName
 * @param {string} opts.legalCompanyName
 * @param {Buffer} opts.signedNdaPdf     - PDF buffer of the signed NDA
 * @param {Buffer} [opts.programLetterPdf] - PDF buffer of the program letter
 * @param {string} opts.ein              - For SendGrid custom args tracking
 * @param {string} opts.envelopeId
 * @param {string} opts.netsuiteVendorId
 */
async function sendWelcomeEmail({
  to,
  firstName,
  lastName,
  legalCompanyName,
  signedNdaPdf,
  programLetterPdf,
  ein,
  envelopeId,
  netsuiteVendorId,
}) {
  const attachments = [
    {
      content: signedNdaPdf.toString("base64"),
      filename: "AETI_NDA_Signed.pdf",
      type: "application/pdf",
      disposition: "attachment",
    },
  ];

  if (programLetterPdf) {
    attachments.push({
      content: programLetterPdf.toString("base64"),
      filename: "AETI_Reseller_Program_Letter.pdf",
      type: "application/pdf",
      disposition: "attachment",
    });
  }

  const msg = {
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    templateId: TEMPLATE_WELCOME,
    dynamicTemplateData: {
      firstName,
      lastName,
      legalCompanyName,
      supportEmail: "resellers@pcsww.com",
    },
    attachments,
    customArgs: {
      reseller_ein: ein,
      docusign_envelope_id: envelopeId,
      netsuite_vendor_id: netsuiteVendorId || "",
    },
  };

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
  ein,
  resellerId,
}) {
  const msg = {
    to: OPS_ALERT_EMAIL,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    templateId: TEMPLATE_INTERNAL_ALERT,
    dynamicTemplateData: {
      legalCompanyName,
      contactEmail,
      contactName: `${contactFirstName} ${contactLastName}`,
      ein,
      resellerId,
      submittedAt: new Date().toISOString(),
    },
    customArgs: {
      reseller_ein: ein,
      reseller_id: resellerId,
    },
  };

  await sgMail.send(msg);
}

module.exports = { sendWelcomeEmail, sendInternalAlert };
