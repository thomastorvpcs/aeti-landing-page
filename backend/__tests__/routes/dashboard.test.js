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

jest.mock("../../src/db", () => ({ query: jest.fn() }));
jest.mock("../../src/services/queue", () => ({ enqueue: jest.fn().mockResolvedValue({}) }));
jest.mock("../../src/services/storage", () => ({
  downloadFile: jest.fn(),
  blobExists: jest.fn(),
  deleteFolder: jest.fn(),
}));
jest.mock("../../src/services/acrobat-sign", () => ({
  sendReminder: jest.fn(),
  cancelAgreement: jest.fn(),
  sendNdaAgreement: jest.fn(),
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
// Bypass JWT verification — auth itself is not under test here
jest.mock("../../src/middleware/requireDashboardAuth", () => (req, _res, next) => {
  req.dashboardUser = { id: "test-user-id", email: "ops@pcsww.com", name: "Ops User" };
  next();
});

const pool = require("../../src/db");
const { enqueue } = require("../../src/services/queue");

const RESELLER_ID = "11111111-2222-3333-4444-555555555555";

// The routes read the reseller row first, then write. Queue the SELECT result and let
// every later query (the UPDATE, the audit-log INSERT) resolve to an empty result.
function mockResellerRow(row) {
  pool.query.mockReset();
  pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
  pool.query.mockResolvedValueOnce({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
}

beforeEach(() => {
  enqueue.mockClear();
});

describe("POST /api/dashboard/resellers/:id/manual-nda", () => {
  test("400s when the reseller is not at NDA Approval Pending", async () => {
    mockResellerRow({ id: RESELLER_ID, legal_company_name: "Acme Ltd", status: "NDA Pending" });

    const res = await request(app)
      .post(`/api/dashboard/resellers/${RESELLER_ID}/manual-nda`)
      .send({ reason: "Signed under existing MSA" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/NDA Approval Pending/);
  });

  test("400s when no reason is supplied", async () => {
    mockResellerRow({ id: RESELLER_ID, legal_company_name: "Acme Ltd", status: "NDA Approval Pending" });

    const res = await request(app)
      .post(`/api/dashboard/resellers/${RESELLER_ID}/manual-nda`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason is required/i);
  });

  test("400s when the reason is only whitespace", async () => {
    mockResellerRow({ id: RESELLER_ID, legal_company_name: "Acme Ltd", status: "NDA Approval Pending" });

    const res = await request(app)
      .post(`/api/dashboard/resellers/${RESELLER_ID}/manual-nda`)
      .send({ reason: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason is required/i);
  });

  test("switches to Manual NDA and audits the reason", async () => {
    mockResellerRow({ id: RESELLER_ID, legal_company_name: "Acme Ltd", status: "NDA Approval Pending" });

    const res = await request(app)
      .post(`/api/dashboard/resellers/${RESELLER_ID}/manual-nda`)
      .send({ reason: "Signed under existing MSA" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ manual: true });

    const statusUpdate = pool.query.mock.calls.find(([sql]) => /SET status = 'Manual NDA'/.test(sql));
    expect(statusUpdate).toBeDefined();

    const auditInsert = pool.query.mock.calls.find(([sql]) => /INSERT INTO audit_log/.test(sql));
    expect(auditInsert[1]).toEqual(
      expect.arrayContaining(["NDA set to manual handling", "ops@pcsww.com", "Signed under existing MSA"])
    );
  });

  test("404s for an unknown reseller", async () => {
    mockResellerRow(null);

    const res = await request(app)
      .post(`/api/dashboard/resellers/${RESELLER_ID}/manual-nda`)
      .send({ reason: "whatever" });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/dashboard/resellers/:id/approve-manual-nda", () => {
  test("400s when the reseller is not at Manual NDA", async () => {
    mockResellerRow({ id: RESELLER_ID, legal_company_name: "Acme Ltd", status: "NDA Approval Pending" });

    const res = await request(app)
      .post(`/api/dashboard/resellers/${RESELLER_ID}/approve-manual-nda`)
      .send({ reason: "Countersigned 2026-08-01" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Manual NDA/);
    expect(enqueue).not.toHaveBeenCalled();
  });

  test("400s when no reason is supplied, without enqueuing", async () => {
    mockResellerRow({ id: RESELLER_ID, legal_company_name: "Acme Ltd", status: "Manual NDA" });

    const res = await request(app)
      .post(`/api/dashboard/resellers/${RESELLER_ID}/approve-manual-nda`)
      .send({});

    expect(res.status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  test("enqueues MANUAL_NDA_COMPLETED on the happy path", async () => {
    mockResellerRow({
      id: RESELLER_ID,
      legal_company_name: "Acme Ltd",
      status: "Manual NDA",
      contact_email: "buyer@acme.test",
      contact_first_name: "Ada",
      contact_last_name: "Lovelace",
    });

    const res = await request(app)
      .post(`/api/dashboard/resellers/${RESELLER_ID}/approve-manual-nda`)
      .send({ reason: "Countersigned 2026-08-01" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ queued: true });
    expect(enqueue).toHaveBeenCalledWith(
      "MANUAL_NDA_COMPLETED",
      expect.objectContaining({ resellerId: RESELLER_ID, contactEmail: "buyer@acme.test" })
    );
  });
});

describe("POST /api/dashboard/resellers/:id/revert-manual-nda", () => {
  test("reverts a Manual NDA record to NDA Approval Pending", async () => {
    mockResellerRow({ id: RESELLER_ID, legal_company_name: "Acme Ltd", status: "Manual NDA" });

    const res = await request(app).post(`/api/dashboard/resellers/${RESELLER_ID}/revert-manual-nda`).send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reverted: true });
    expect(pool.query.mock.calls.some(([sql]) => /SET status = 'NDA Approval Pending'/.test(sql))).toBe(true);
  });

  test("400s from Manual NDA Complete — completed onboarding is not undoable", async () => {
    mockResellerRow({ id: RESELLER_ID, legal_company_name: "Acme Ltd", status: "Manual NDA Complete" });

    const res = await request(app).post(`/api/dashboard/resellers/${RESELLER_ID}/revert-manual-nda`).send({});

    expect(res.status).toBe(400);
  });
});

describe("POST /api/dashboard/resellers/:id/retry-completion", () => {
  test("enqueues MANUAL_NDA_COMPLETED for a Manual NDA Complete record with no envelope", async () => {
    mockResellerRow({
      id: RESELLER_ID,
      legal_company_name: "Acme Ltd",
      status: "Manual NDA Complete",
      docusign_envelope_id: null,
      contact_email: "buyer@acme.test",
      contact_first_name: "Ada",
      contact_last_name: "Lovelace",
    });

    const res = await request(app).post(`/api/dashboard/resellers/${RESELLER_ID}/retry-completion`).send({});

    expect(res.status).toBe(200);
    expect(enqueue).toHaveBeenCalledWith(
      "MANUAL_NDA_COMPLETED",
      expect.objectContaining({ resellerId: RESELLER_ID, force: true })
    );
  });

  test("still enqueues NDA_COMPLETED for the e-sign path", async () => {
    mockResellerRow({
      id: RESELLER_ID,
      legal_company_name: "Acme Ltd",
      status: "NDA Complete",
      docusign_envelope_id: "CBJCHBCAABAA-test",
      contact_email: "buyer@acme.test",
      contact_first_name: "Ada",
      contact_last_name: "Lovelace",
    });

    const res = await request(app).post(`/api/dashboard/resellers/${RESELLER_ID}/retry-completion`).send({});

    expect(res.status).toBe(200);
    expect(enqueue).toHaveBeenCalledWith(
      "NDA_COMPLETED",
      expect.objectContaining({ envelopeId: "CBJCHBCAABAA-test", force: true })
    );
  });

  test("still 400s for an e-sign record with no agreement on file", async () => {
    mockResellerRow({
      id: RESELLER_ID,
      legal_company_name: "Acme Ltd",
      status: "NDA Complete",
      docusign_envelope_id: null,
    });

    const res = await request(app).post(`/api/dashboard/resellers/${RESELLER_ID}/retry-completion`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No agreement ID/);
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("POST /api/dashboard/resellers/:id/send-nda", () => {
  test("refuses to create an envelope for a Manual NDA record", async () => {
    mockResellerRow({ id: RESELLER_ID, legal_company_name: "Acme Ltd", status: "Manual NDA" });

    const { sendNdaAgreement } = require("../../src/services/acrobat-sign");
    const res = await request(app).post(`/api/dashboard/resellers/${RESELLER_ID}/send-nda`).send({});

    expect(res.status).toBe(400);
    expect(sendNdaAgreement).not.toHaveBeenCalled();
  });
});
