const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const isLocal = process.env.NODE_ENV !== "production";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  },
  ...(isLocal && {
    endpoint: process.env.AWS_ENDPOINT || "http://localhost:4566",
    forcePathStyle: true,
  }),
});

const BUCKET = process.env.S3_BUCKET || "aeti-reseller-docs";

/**
 * Upload a file buffer to S3 with AES-256 server-side encryption.
 * Returns the S3 object key.
 */
async function uploadFile({ key, buffer, contentType }) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
      ACL: "private",
    })
  );
  return key;
}

/**
 * Download a file from S3 and return its Buffer.
 */
async function downloadFile(key) {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Generate a pre-signed GET URL (for internal use only — not for public exposure).
 */
async function getPresignedUrl(key, expiresInSeconds = 3600) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

module.exports = { uploadFile, downloadFile, getPresignedUrl };
