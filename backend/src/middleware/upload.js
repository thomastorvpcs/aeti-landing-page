const multer = require("multer");
const { fileTypeFromBuffer } = require("file-type");

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_SIZE,
    files: 2,        // W-9 and bank letter only
    fields: 50,      // reasonable upper bound for form fields
    fieldSize: 10 * 1024, // 10 KB per text field
  },
  fileFilter(_req, file, cb) {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, and PNG files are accepted."));
    }
  },
});

// Second-pass validation: verify actual file magic bytes match the declared
// MIME type. Runs after Multer so the buffer is available in memory.
// Rejects files where the content doesn't match what the header claims.
async function validateFileMagicBytes(req, res, next) {
  const files = Object.values(req.files || {}).flat();
  for (const file of files) {
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_TYPES.includes(detected.mime)) {
      return res.status(422).json({
        error: `File "${file.originalname}" is not a valid PDF, JPG, or PNG.`,
      });
    }
  }
  next();
}

module.exports = { upload, validateFileMagicBytes };
