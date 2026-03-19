const PDFDocument = require("pdfkit");
const path = require("path");

const LETTERHEAD_PATH = path.join(__dirname, "../assets/PCSletterhead.jpg");

/**
 * Generate the PCS Wireless Authorized Reseller letter as a PDF buffer.
 */
function generateAuthorizationLetter({ legalCompanyName }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: "letter" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Letterhead image centered at top
    doc.image(LETTERHEAD_PATH, 60, 40, { width: 492, align: "center" });
    doc.moveDown(6);

    // Date
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.fontSize(11).font("Helvetica").text(`Date: ${dateStr}`);
    doc.moveDown();

    // Addressee
    doc.text(`To: ${legalCompanyName} ("Reseller")`);
    doc.moveDown();

    // Subject
    doc.text("Re: Apple Enterprise Trade-In Program");
    doc.moveDown();

    // Body
    doc.text(
      `This letter serves to confirm that PCS Wireless LLC ("PCS") acknowledges and agrees that Reseller's role in the transactions under the Apple Enterprise Trade-In Program ("TIP") between PCS and those customers who have designated Reseller as their reseller is strictly limited to receiving payment on behalf of such customers for the amounts due, if any, from PCS to such customers.`,
      { align: "justify" }
    );
    doc.moveDown(2);

    // Closing
    doc.text("Sincerely,");
    doc.moveDown(3);
    doc.text("Chaim T. Nash");
    doc.text("CEO");
    doc.text("PCS Wireless LLC");

    doc.end();
  });
}

module.exports = { generateAuthorizationLetter };
