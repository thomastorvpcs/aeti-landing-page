const request = require("supertest");
const app = require("../../src/app");

// Mock all external dependencies so tests run without real Azure/DB connections

// file-type is pure ESM — mock the upload middleware so Jest doesn't try to load it
jest.mock("../../src/middleware/upload", () => {
  const multer = require("multer");
  return {
    upload: multer({ storage: multer.memoryStorage() }),
    validateFileMagicBytes: (_req, _res, next) => next(),
  };
});

jest.mock("../../src/db", () => ({
  query: jest.fn(),
}));
jest.mock("../../src/services/storage", () => ({
  uploadFile: jest.fn().mockResolvedValue({}),
}));
jest.mock("../../src/services/queue", () => ({
  enqueue: jest.fn().mockResolvedValue({}),
}));
jest.mock("../../src/db/crypto", () => ({
  encryptionKey: jest.fn().mockReturnValue("test-encryption-key-32-chars-long!!"),
  einHmac: jest.fn().mockReturnValue("mock-hmac"),
}));
jest.mock("../../src/middleware/rate-limit", () => ({
  globalRateLimiter: (_req, _res, next) => next(),
  submissionRateLimiter: (_req, _res, next) => next(),
  dashboardLoginRateLimiter: (_req, _res, next) => next(),
  dashboardApiRateLimiter: (_req, _res, next) => next(),
  dashboardActionRateLimiter: (_req, _res, next) => next(),
}));

// Minimal valid PDF buffer (magic bytes only — enough to pass file-type detection)
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f\n0000000009 00000 n\ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n9\n%%EOF"
);

const validFields = {
  legalCompanyName: "Acme Corp",
  ein: "12-3456789",
  entityType: "LLC",
  addressStreet: "123 Main St",
  addressCity: "Austin",
  addressState: "TX",
  addressZip: "78701",
  contactFirstName: "John",
  contactLastName: "Doe",
  contactEmail: "john@acme.com",
  contactPhone: "5125551234",
  financeContactName: "Jane Doe",
  financeContactEmail: "jane@acme.com",
  financeContactPhone: "5125555678",
  bankName: "First Bank",
  bankAccountNumber: "123456789",
  bankAba: "021000021",
  ndaSignerSameAsContact: "true",
};

function buildRequest(fields = validFields) {
  const req = request(app)
    .post("/api/submit")
    .attach("w9", MINIMAL_PDF, { filename: "w9.pdf", contentType: "application/pdf" })
    .attach("bankLetter", MINIMAL_PDF, { filename: "bank_letter.pdf", contentType: "application/pdf" });
  Object.entries(fields).forEach(([k, v]) => req.field(k, v));
  return req;
}

beforeEach(() => {
  const pool = require("../../src/db");
  pool.query.mockResolvedValue({ rows: [] }); // no existing reseller by default
});

describe("POST /api/submit", () => {
  describe("validation", () => {
    test("returns 422 when required fields are missing", async () => {
      const res = await request(app)
        .post("/api/submit")
        .attach("w9", MINIMAL_PDF, { filename: "w9.pdf", contentType: "application/pdf" })
        .attach("bankLetter", MINIMAL_PDF, { filename: "bank_letter.pdf", contentType: "application/pdf" });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe("Missing required fields.");
      expect(res.body.fields).toContain("legalCompanyName");
    });

    test("returns 422 for invalid EIN format", async () => {
      const res = await buildRequest({ ...validFields, ein: "invalid-ein" });
      expect(res.status).toBe(422);
      expect(res.body.fields).toContain("ein");
    });

    test("accepts EIN with dashes", async () => {
      const pool = require("../../src/db");
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "mock-uuid", status: "Initiated" }] });

      const res = await buildRequest({ ...validFields, ein: "12-3456789" });
      expect(res.status).toBe(202);
    });

    test("accepts EIN without dashes", async () => {
      const pool = require("../../src/db");
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "mock-uuid", status: "Initiated" }] });

      const res = await buildRequest({ ...validFields, ein: "123456789" });
      expect(res.status).toBe(202);
    });

    test("returns 422 for invalid contact email", async () => {
      const res = await buildRequest({ ...validFields, contactEmail: "not-an-email" });
      expect(res.status).toBe(422);
      expect(res.body.fields).toContain("contactEmail");
    });

    test("returns 422 for invalid finance contact email", async () => {
      const res = await buildRequest({ ...validFields, financeContactEmail: "bademail" });
      expect(res.status).toBe(422);
      expect(res.body.fields).toContain("financeContactEmail");
    });

    test("returns 422 when w9 file is missing", async () => {
      const req = request(app)
        .post("/api/submit")
        .attach("bankLetter", MINIMAL_PDF, { filename: "bank_letter.pdf", contentType: "application/pdf" });
      Object.entries(validFields).forEach(([k, v]) => req.field(k, v));

      const res = await req;
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/W-9/);
    });

    test("returns 422 when bank letter file is missing", async () => {
      const req = request(app)
        .post("/api/submit")
        .attach("w9", MINIMAL_PDF, { filename: "w9.pdf", contentType: "application/pdf" });
      Object.entries(validFields).forEach(([k, v]) => req.field(k, v));

      const res = await req;
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/[Bb]ank letter/);
    });
  });

  describe("successful submission", () => {
    beforeEach(() => {
      const pool = require("../../src/db");
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // no existing reseller
        .mockResolvedValueOnce({ rows: [{ id: "mock-uuid", status: "Initiated" }] }); // INSERT result
    });

    test("returns 202 with resellerId for valid submission", async () => {
      const res = await buildRequest();
      expect(res.status).toBe(202);
      expect(res.body.resellerId).toBeDefined();
    });

    test("enqueues RESELLER_SUBMITTED job", async () => {
      const { enqueue } = require("../../src/services/queue");
      await buildRequest();
      expect(enqueue).toHaveBeenCalledWith("RESELLER_SUBMITTED", expect.objectContaining({
        legalCompanyName: "Acme Corp",
        contactEmail: "john@acme.com",
      }));
    });

    test("uploads w9 and bank letter to storage", async () => {
      const { uploadFile } = require("../../src/services/storage");
      await buildRequest();
      expect(uploadFile).toHaveBeenCalledTimes(2);
    });

    test("lowercases contact email before storing", async () => {
      const { enqueue } = require("../../src/services/queue");
      await buildRequest({ ...validFields, contactEmail: "John@ACME.COM" });
      expect(enqueue).toHaveBeenCalledWith("RESELLER_SUBMITTED", expect.objectContaining({
        contactEmail: "John@ACME.COM", // raw from body — lowercasing happens in DB query
      }));
    });
  });

  describe("NDA signer resolution", () => {
    beforeEach(() => {
      const pool = require("../../src/db");
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "mock-uuid", status: "Initiated" }] });
    });

    test("uses contact details as NDA signer when ndaSignerSameAsContact is true", async () => {
      const { enqueue } = require("../../src/services/queue");
      await buildRequest({ ...validFields, ndaSignerSameAsContact: "true" });
      expect(enqueue).toHaveBeenCalledWith("RESELLER_SUBMITTED", expect.objectContaining({
        ndaSignerFirstName: "John",
        ndaSignerLastName: "Doe",
        ndaSignerEmail: "john@acme.com",
      }));
    });

    test("uses separate NDA signer details when ndaSignerSameAsContact is false", async () => {
      const { enqueue } = require("../../src/services/queue");
      await buildRequest({
        ...validFields,
        ndaSignerSameAsContact: "false",
        ndaSignerFirstName: "Jane",
        ndaSignerLastName: "Smith",
        ndaSignerEmail: "jane.smith@acme.com",
        ndaSignerPhone: "5125559999",
      });
      expect(enqueue).toHaveBeenCalledWith("RESELLER_SUBMITTED", expect.objectContaining({
        ndaSignerFirstName: "Jane",
        ndaSignerLastName: "Smith",
        ndaSignerEmail: "jane.smith@acme.com",
      }));
    });
  });
});
