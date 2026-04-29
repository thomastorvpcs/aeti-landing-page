const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const FROM_NAME = process.env.SENDGRID_FROM_NAME;
const SUPPORT_EMAIL = process.env.SENDGRID_SUPPORT_EMAIL;
const OPS_ALERT_EMAIL = process.env.PCS_OPS_EMAIL;

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
      filename: "ABTI_NDA_Signed.pdf",
      type: "application/pdf",
      disposition: "attachment",
    },
  ];

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
      reseller_ein: ein,
      docusign_envelope_id: envelopeId,
      netsuite_vendor_id: netsuiteVendorId || "",
    },
  };

  if (TEMPLATE_WELCOME) {
    msg.templateId = TEMPLATE_WELCOME;
    msg.dynamicTemplateData = {
      firstName,
      lastName,
      legalCompanyName,
      supportEmail: SUPPORT_EMAIL,
    };
  } else {
    msg.subject = `Welcome to the AETI Reseller Program, ${firstName}!`;
    msg.text = `Hi ${firstName},\n\nThank you for signing the NDA. Your signed agreement is attached.\n\nWelcome to the AETI Reseller Program!\n\nIf you have any questions, contact us at resellers@pcsww.com.\n\nBest regards,\nPCS Partner Program`;
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
  ein,
  resellerId,
  note,
}) {
  const msg = {
    to: OPS_ALERT_EMAIL,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    customArgs: {
      reseller_ein: ein || "",
      reseller_id: resellerId,
    },
  };

  if (TEMPLATE_INTERNAL_ALERT && !note) {
    msg.templateId = TEMPLATE_INTERNAL_ALERT;
    msg.dynamicTemplateData = {
      legalCompanyName,
      contactEmail,
      contactName: `${contactFirstName} ${contactLastName}`,
      ein,
      resellerId,
      submittedAt: new Date().toISOString(),
    };
  } else {
    msg.subject = note || `New AETI reseller submission: ${legalCompanyName}`;
    msg.text = note
      ? `${note}\n\nReseller ID: ${resellerId}\nCompany: ${legalCompanyName}\nTimestamp: ${new Date().toISOString()}`
      : `A new reseller has submitted the onboarding form.\n\nCompany: ${legalCompanyName}\nContact: ${contactFirstName} ${contactLastName}\nEmail: ${contactEmail}\nEIN: ${ein}\nReseller ID: ${resellerId}\nSubmitted: ${new Date().toISOString()}`;
  }

  await sgMail.send(msg);
}

module.exports = { sendWelcomeEmail, sendInternalAlert };
