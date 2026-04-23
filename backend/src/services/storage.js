const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require("@azure/storage-blob");

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER = process.env.AZURE_BLOB_CONTAINER || "reseller-docs";

function getClient() {
  if (!connectionString) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
  return BlobServiceClient.fromConnectionString(connectionString);
}

/**
 * Upload a file buffer to Azure Blob Storage.
 * Returns the blob name (key).
 */
async function uploadFile({ key, buffer, contentType }) {
  const client = getClient();
  const containerClient = client.getContainerClient(CONTAINER);
  const blockBlobClient = containerClient.getBlockBlobClient(key);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
  return key;
}

/**
 * Download a blob and return its Buffer.
 */
async function downloadFile(key) {
  const client = getClient();
  const containerClient = client.getContainerClient(CONTAINER);
  const blockBlobClient = containerClient.getBlockBlobClient(key);
  const downloadResponse = await blockBlobClient.download(0);
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Generate a short-lived SAS URL for a blob.
 */
const DEFAULT_SAS_EXPIRY_SECONDS = parseInt(process.env.AZURE_SAS_EXPIRY_SECONDS || "300", 10);

async function getPresignedUrl(key, expiresInSeconds = DEFAULT_SAS_EXPIRY_SECONDS) {
  const client = getClient();

  // Parse account name and key from connection string
  const accountNameMatch = connectionString.match(/AccountName=([^;]+)/);
  const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);
  if (!accountNameMatch || !accountKeyMatch) throw new Error("Invalid AZURE_STORAGE_CONNECTION_STRING");

  const accountName = accountNameMatch[1];
  const accountKey = accountKeyMatch[1];

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

  const expiresOn = new Date(Date.now() + expiresInSeconds * 1000);

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER,
      blobName: key,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn,
    },
    sharedKeyCredential
  ).toString();

  const containerClient = client.getContainerClient(CONTAINER);
  const blockBlobClient = containerClient.getBlockBlobClient(key);
  return `${blockBlobClient.url}?${sasToken}`;
}

/**
 * Return true if a blob exists in storage.
 */
async function blobExists(key) {
  const client = getClient();
  const containerClient = client.getContainerClient(CONTAINER);
  const blockBlobClient = containerClient.getBlockBlobClient(key);
  return blockBlobClient.exists();
}

/**
 * Delete a single blob.
 */
async function deleteFile(key) {
  const client = getClient();
  const containerClient = client.getContainerClient(CONTAINER);
  await containerClient.getBlockBlobClient(key).deleteIfExists();
}

/**
 * Delete all blobs whose name starts with the given prefix (e.g. "resellers/{id}/").
 */
async function deleteFolder(prefix) {
  const client = getClient();
  const containerClient = client.getContainerClient(CONTAINER);
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    await containerClient.getBlockBlobClient(blob.name).deleteIfExists();
  }
}

module.exports = { uploadFile, downloadFile, getPresignedUrl, blobExists, deleteFile, deleteFolder };
