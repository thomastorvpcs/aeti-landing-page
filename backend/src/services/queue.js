const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");

const isLocal = process.env.NODE_ENV !== "production";

const sqs = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  },
  ...(isLocal && {
    endpoint: process.env.AWS_ENDPOINT || "http://localhost:4566",
  }),
});

const QUEUE_URL =
  process.env.SQS_QUEUE_URL ||
  "http://localhost:4566/000000000000/aeti-onboarding";

/**
 * Enqueue a job. `type` is the job type string; `payload` is an object.
 */
async function enqueue(type, payload) {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({ type, payload }),
      MessageAttributes: {
        jobType: { DataType: "String", StringValue: type },
      },
    })
  );
}

/**
 * Poll for one message. Returns null if queue is empty.
 */
async function receive() {
  const res = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20, // long poll
      MessageAttributeNames: ["All"],
      VisibilityTimeout: 60,
    })
  );
  if (!res.Messages || res.Messages.length === 0) return null;
  const msg = res.Messages[0];
  return {
    receiptHandle: msg.ReceiptHandle,
    body: JSON.parse(msg.Body),
  };
}

/**
 * Delete (ack) a message after successful processing.
 */
async function ack(receiptHandle) {
  await sqs.send(
    new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: receiptHandle })
  );
}

module.exports = { enqueue, receive, ack };
