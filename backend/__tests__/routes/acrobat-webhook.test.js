// Static test-only self-signed certs (1024-bit RSA, CN=test-webhook, 10-year validity).
// Hardcoded to avoid runtime cert generation — these contain no secrets and are not used anywhere else.
const crypto = require("crypto");

const EXPECTED_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIICBDCCAW2gAwIBAgIJVBMLmXwTYkvWMA0GCSqGSIb3DQEBBQUAMBcxFTATBgNV
BAMTDHRlc3Qtd2ViaG9vazAeFw0yNjA0MzAyMTA5MThaFw0yNzA0MzAyMTA5MTha
MBcxFTATBgNVBAMTDHRlc3Qtd2ViaG9vazCBnzANBgkqhkiG9w0BAQEFAAOBjQAw
gYkCgYEA0Ga0vnenO0klL8WYGzhyOG4UNMNqTQsX3d3MJCw8UEA1fcAxrk1zIkiN
JvtQ9wK40NpQaU8D0bZzJgdquOEDbyWCYT5h+lErg9K/TPdxRH4fsb74446+mwtc
p1oGdYW8ZsPt3cekZBXCpBwiCL3oIlT3nwxbZ98XdJSCrgOXpXUCAwEAAaNYMFYw
DAYDVR0TAQH/BAIwADAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYIKwYBBQUH
AwEGCCsGAQUFBwMCMBcGA1UdEQQQMA6CDHRlc3Qtd2ViaG9vazANBgkqhkiG9w0B
AQUFAAOBgQAaIomrzuLUcZVerEq4mCRF7/HJxI+abEQ8LosYFyICXQyHDHJBTMEZ
0KL6dlNY2PA9dm1egoVfnsYKifcQJYnkZOMzTLAHZ9BJM262ihhirl7VFpwzg23x
SpJVKrzIs/6egEBudXNCcWZVcucL6xjMnyzdsQd0//RwwY2wUQ7DYw==
-----END CERTIFICATE-----`;

const WRONG_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIICBDCCAW2gAwIBAgIJaDrNSgaXyLt9MA0GCSqGSIb3DQEBBQUAMBcxFTATBgNV
BAMTDHRlc3Qtd2ViaG9vazAeFw0yNjA0MzAyMTA5MThaFw0yNzA0MzAyMTA5MTha
MBcxFTATBgNVBAMTDHRlc3Qtd2ViaG9vazCBnzANBgkqhkiG9w0BAQEFAAOBjQAw
gYkCgYEApZKSk2An86SqqLQG7NKZ63DhQZOfFtUSDsGOZFf2RvIZwXIW4gLIvoeA
lRwwoNAqNpZ8Lhaw4azq8jQe47bcD9N0Un8M0kb4vp+owugFnkibUK7anC06glvJ
1BlTqbR0Krbw0V3r09a5JcSrj5V2cN6SWEZ3riVVSx+Hu/UNrxcCAwEAAaNYMFYw
DAYDVR0TAQH/BAIwADAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYIKwYBBQUH
AwEGCCsGAQUFBwMCMBcGA1UdEQQQMA6CDHRlc3Qtd2ViaG9vazANBgkqhkiG9w0B
AQUFAAOBgQCgJb4z5TwKlwYeS9BRlS0eI5aYJ2jgiv9j9yn8R01WUE2l0PlChyCL
jz0PqpQeEMw4dPcLPDxrdvMiP/QTYrjpbAVzp23SAqf4vHLD689XcOyz0T1RpkAE
nd1hJNNDedIvUbGBh/yQn4QLk17sTHlL9YySFt3oVU8S7Sr5R9QaPw==
-----END CERTIFICATE-----`;

// ACROBAT_WEBHOOK_CERT and ACROBAT_CLIENT_ID are read at require time by the route module,
// so they must be set here — before require("../../src/app") is called below.
process.env.ACROBAT_WEBHOOK_CERT = EXPECTED_CERT_PEM;
process.env.ACROBAT_CLIENT_ID    = "ats-test-client-id";

const VALID_CERT_HEADER   = new crypto.X509Certificate(EXPECTED_CERT_PEM).raw.toString("base64");
const WRONG_CERT_HEADER   = new crypto.X509Certificate(WRONG_CERT_PEM).raw.toString("base64");
const INVALID_CERT_HEADER = Buffer.from("not-a-cert").toString("base64");

const request = require("supertest");
const app = require("../../src/app");

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

describe("client certificate verification", () => {
  test("returns 401 when X-ARR-ClientCert header is absent", async () => {
    const res = await request(app)
      .get("/acrobat/webhook")
      .set("X-AdobeSign-ClientId", CLIENT_ID);
    expect(res.status).toBe(401);
  });

  test("returns 401 when X-ARR-ClientCert is a valid cert with the wrong fingerprint", async () => {
    const res = await request(app)
      .get("/acrobat/webhook")
      .set("X-AdobeSign-ClientId", CLIENT_ID)
      .set("X-ARR-ClientCert", WRONG_CERT_HEADER);
    expect(res.status).toBe(401);
  });

  test("returns 401 when X-ARR-ClientCert is not a valid DER certificate", async () => {
    const res = await request(app)
      .get("/acrobat/webhook")
      .set("X-AdobeSign-ClientId", CLIENT_ID)
      .set("X-ARR-ClientCert", INVALID_CERT_HEADER);
    expect(res.status).toBe(401);
  });
});

describe("GET /acrobat/webhook (verification)", () => {
  test("returns 200 with client ID echo when client ID matches", async () => {
    const res = await request(app)
      .get("/acrobat/webhook")
      .set("X-AdobeSign-ClientId", CLIENT_ID)
      .set("X-ARR-ClientCert", VALID_CERT_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.xAdobeSignClientId).toBe(CLIENT_ID);
    expect(res.headers["x-adobesign-clientid"]).toBe(CLIENT_ID);
  });

  test("returns 400 when client ID does not match", async () => {
    const res = await request(app)
      .get("/acrobat/webhook")
      .set("X-AdobeSign-ClientId", "wrong-client-id")
      .set("X-ARR-ClientCert", VALID_CERT_HEADER);

    expect(res.status).toBe(400);
  });

  test("returns 400 when client ID header is missing", async () => {
    const res = await request(app)
      .get("/acrobat/webhook")
      .set("X-ARR-ClientCert", VALID_CERT_HEADER);

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
      .set("X-ARR-ClientCert", VALID_CERT_HEADER)
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
      .set("X-ARR-ClientCert", VALID_CERT_HEADER)
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
