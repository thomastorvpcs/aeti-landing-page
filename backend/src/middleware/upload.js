const multer = require("multer");

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

module.exports = upload;
