const PDFDocument = require("pdfkit");
const path = require("path");

const LETTERHEAD_PATH = path.join(__dirname, "../assets/PCSletterhead.jpg");
const SIGNATURE_PATH = path.join(__dirname, "../assets/signature.png");

/**
 * Generate the PCS Wireless Authorized Reseller letter as a PDF buffer.
 */
function drawPageFooter(doc) {
  const pageWidth = doc.page.width;
  const footerY = doc.page.height - 72; // ~1 inch from bottom
  const leftX = 60;
  const rightX = pageWidth - 60;
  // Horizontal rule
  doc.moveTo(leftX, footerY).lineTo(rightX, footerY).strokeColor("#aaaaaa").lineWidth(0.5).stroke();

  // Footer text
  doc
    .fontSize(7.5)
    .font("Helvetica")
    .fillColor("#555555")
    .text(
      "Phone: +1 973.805.7400   |   Fax: +1 973.301.0975   |   11 Vreeland Road, Florham Park, NJ 07932   |   www.pcsww.com",
      leftX,
      footerY + 6,
      { width: rightX - leftX, align: "center" }
    );

  // Reset color
  doc.fillColor("#000000").strokeColor("#000000").lineWidth(1);
}

function generateAuthorizationLetter({ legalCompanyName }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margins: { top: 60, right: 60, bottom: 30, left: 60 }, size: "letter" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Letterhead image centered at top
    doc.image(LETTERHEAD_PATH, 60, 40, { width: 492, align: "center" });
    doc.y = 180; // Start content below the letterhead regardless of image height

    // Date
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.fontSize(11).font("Helvetica").text(`Date: ${dateStr}`);
    doc.moveDown(0.5);

    // Addressee
    doc.text(`To: ${legalCompanyName} ("Reseller")`);
    doc.moveDown(0.5);

    // Subject
    doc.text("Re: Apple Business Trade-In Program");
    doc.moveDown(0.5);

    // Body
    doc.text(
      `This letter serves to confirm that PCS Wireless LLC ("PCS") acknowledges and agrees that Reseller's role in the transactions under the Apple Business Trade-In Program ("TIP") between PCS and those customers who have designated Reseller as their reseller is strictly limited to receiving payment on behalf of such customers for the amounts due, if any, from PCS to such customers.`,
      { align: "justify" }
    );
    doc.moveDown(1);

    // Closing
    doc.text("Sincerely,");
    doc.moveDown(0.3);
    doc.image(SIGNATURE_PATH, { width: 120 });
    doc.moveDown(1);
    doc.text("Chaim T. Nash");
    doc.text("CEO");
    doc.text("PCS Wireless LLC");

    drawPageFooter(doc);
    doc.end();
  });
}

/**
 * Generate a Vendor Setup Form PDF with all submitted form fields.
 */
function generateVendorSetupForm(reseller) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: "letter" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Header
    doc.image(LETTERHEAD_PATH, 60, 40, { width: 492, align: "center" });
    doc.moveDown(6);
    doc.fontSize(14).font("Helvetica-Bold").text("Vendor Setup Form", { align: "center" });
    doc.fontSize(10).font("Helvetica").text(`Submitted: ${today}`, { align: "center" });
    doc.moveDown(1.5);

    function section(title) {
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333").text(title);
      doc.moveTo(60, doc.y).lineTo(552, doc.y).strokeColor("#cccccc").stroke();
      doc.moveDown(0.5);
      doc.fillColor("#000000");
    }

    function field(label, value) {
      doc.fontSize(10).font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value || "—");
    }

    // Company Information
    section("Company Information");
    field("Legal Company Name", reseller.legal_company_name);
    field("DBA", reseller.dba);
    field("EIN", reseller.ein);
    field("Entity Type", reseller.entity_type);
    field("Website", reseller.website);
    doc.moveDown(0.3);
    field("Business Address", [reseller.address_street, reseller.address_city, reseller.address_state, reseller.address_zip, reseller.address_country].filter(Boolean).join(", "));
    const billingAddr = [reseller.billing_address_street, reseller.billing_address_city, reseller.billing_address_state, reseller.billing_address_zip, reseller.billing_address_country].filter(Boolean).join(", ");
    field("Billing Address", billingAddr || "Same as business address");

    // Commercial Contact
    section("Commercial Contact");
    field("Name", `${reseller.contact_first_name} ${reseller.contact_last_name}`);
    field("Title", reseller.contact_title);
    field("Email", reseller.contact_email);
    field("Phone", reseller.contact_phone);

    // NDA Signatory — only shown when different from commercial contact
    if (reseller.nda_signer_email && reseller.nda_signer_email !== reseller.contact_email) {
      section("NDA Signatory");
      field("Name", `${reseller.nda_signer_first_name} ${reseller.nda_signer_last_name}`);
      field("Title", reseller.nda_signer_title);
      field("Email", reseller.nda_signer_email);
      field("Phone", reseller.nda_signer_phone);
    }

    // Finance Contact
    section("Finance Contact");
    field("Name", reseller.finance_contact_name);
    field("Title", reseller.finance_contact_title);
    field("Email", reseller.finance_contact_email);
    field("Phone", reseller.finance_contact_phone);

    // Banking Details
    section("Banking Details");
    field("Bank Name", reseller.bank_name);
    field("Bank Address", reseller.bank_address);
    field("Account Number", reseller.bank_account_number);
    field("ABA / Routing Number", reseller.bank_aba);
    field("SWIFT Code", reseller.bank_swift);

    doc.end();
  });
}

module.exports = { generateAuthorizationLetter, generateVendorSetupForm };
