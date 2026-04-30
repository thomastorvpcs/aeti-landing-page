// Set env vars before loading the app — modules read these at require time
process.env.ACROBAT_CLIENT_ID = "ats-test-client-id";

const request = require("supertest");
const app = require("../../src/app");

// file-type is pure ESM — mock upload middleware to prevent loading it
jest.mock("../../src/middleware/upload", () => {
  const multer = require("multer");
  return {
    upload: multer({ storage: multer.memoryStorage() }),
    validateFileMagicBytes: (_req, _res, next) => next(),
  };
});

jest.mock("../../src/db", () => ({ query: jest.fn() }));
jest.mock("../../src/services/queue", () => ({ enqueue: jest.fn().mockResolvedValue({}) }));
jest.mock("../../src/services/acrobat-sign", () => ({ getAgreementStatus: jest.fn() }));
jest.mock("../../src/middleware/rate-limit", () => ({
  globalRateLimiter: (_req, _res, next) => next(),
  submissionRateLimiter: (_req, _res, next) => next(),
  dashboardLoginRateLimiter: (_req, _res, next) => next(),
  dashboardApiRateLimiter: (_req, _res, next) => next(),
  dashboardActionRateLimiter: (_req, _res, next) => next(),
}));

const CLIENT_ID = "ats-test-client-id";

describe("GET /acrobat/webhook (verification)", () => {
  test("returns 200 with client ID echo when client ID matches", async () => {
    const res = await request(app)
      .get("/acrobat/webhook")
      .set("X-AdobeSign-ClientId", CLIENT_ID);

    expect(res.status).toBe(200);
    expect(res.body.xAdobeSignClientId).toBe(CLIENT_ID);
    expect(res.headers["x-adobesign-clientid"]).toBe(CLIENT_ID);
  });

  test("returns 400 when client ID does not match", async () => {
    const res = await request(app)
      .get("/acrobat/webhook")
      .set("X-AdobeSign-ClientId", "wrong-client-id");

    expect(res.status).toBe(400);
  });

  test("returns 400 when client ID header is missing", async () => {
    const res = await request(app).get("/acrobat/webhook");
    expect(res.status).toBe(400);
  });
});

describe("POST /acrobat/webhook (events)", () => {
  const agreementId = "test-agreement-id";
  const reseller = {
    id: "reseller-uuid",
    status: "NDA Pending",
    contact_email: "john@acme.com",
    contact_first_name: "John",
    contact_last_name: "Doe",
    legal_company_name: "Acme Corp",
  };

  function postEvent(payload) {
    return request(app)
      .post("/acrobat/webhook")
      .set("X-AdobeSign-ClientId", CLIENT_ID)
      .send(payload);
  }

  beforeEach(() => {
    const pool = require("../../src/db");
    pool.query.mockResolvedValue({ rows: [reseller], rowCount: 1 });
  });

  test("returns 401 when client ID does not match", async () => {
    const res = await request(app)
      .post("/acrobat/webhook")
      .set("X-AdobeSign-ClientId", "wrong-id")
      .send({});
    expect(res.status).toBe(401);
  });

  test("returns 200 immediately for all valid events", async () => {
    const res = await postEvent({
      event: "AGREEMENT_WORKFLOW_COMPLETED",
      agreement: { id: agreementId, status: "SIGNED" },
    });
    expect(res.status).toBe(200);
  });

  test("enqueues NDA_COMPLETED on AGREEMENT_WORKFLOW_COMPLETED", async () => {
    const { enqueue } = require("../../src/services/queue");
    await postEvent({
      event: "AGREEMENT_WORKFLOW_COMPLETED",
      agreement: { id: agreementId, status: "SIGNED" },
    });

    // Give async processing time to run
    await new Promise((r) => setTimeout(r, 50));

    expect(enqueue).toHaveBeenCalledWith("NDA_COMPLETED", expect.objectContaining({
      resellerId: reseller.id,
      envelopeId: agreementId,
    }));
  });

  test("updates status to Awaiting Countersign on reseller ESIGNED event", async () => {
    const pool = require("../../src/db");
    await postEvent({
      event: "AGREEMENT_ACTION_COMPLETED",
      actionType: "ESIGNED",
      agreement: { id: agreementId, status: "OUT_FOR_SIGNATURE" },
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("reseller_signed_at"),
      ["Awaiting Countersign", reseller.id]
    );
  });

  test("skips unrelated events", async () => {
    const { enqueue } = require("../../src/services/queue");
    await postEvent({
      event: "AGREEMENT_CREATED",
      agreement: { id: agreementId },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(enqueue).not.toHaveBeenCalled();
  });

  test("returns 200 even when no reseller is found", async () => {
    const pool = require("../../src/db");
    pool.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await postEvent({
      event: "AGREEMENT_WORKFLOW_COMPLETED",
      agreement: { id: "unknown-agreement", status: "SIGNED" },
    });
    expect(res.status).toBe(200);
  });
});
