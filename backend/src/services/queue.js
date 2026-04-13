const { ServiceBusClient } = require("@azure/service-bus");

const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const QUEUE_NAME = process.env.AZURE_SERVICE_BUS_QUEUE_NAME || "onboarding-jobs";

function getClient() {
  if (!connectionString) throw new Error("AZURE_SERVICE_BUS_CONNECTION_STRING is not set");
  return new ServiceBusClient(connectionString);
}

/**
 * Enqueue a job. `type` is the job type string; `payload` is an object.
 */
async function enqueue(type, payload) {
  const client = getClient();
  const sender = client.createSender(QUEUE_NAME);
  try {
    await sender.sendMessages({
      body: JSON.stringify({ type, payload }),
      applicationProperties: { jobType: type },
    });
  } finally {
    await sender.close();
    await client.close();
  }
}

/**
 * Poll for one message. Returns null if queue is empty.
 */
async function receive() {
  const client = getClient();
  const receiver = client.createReceiver(QUEUE_NAME, { receiveMode: "peekLock" });
  try {
    const messages = await receiver.receiveMessages(1, { maxWaitTimeInMs: 20000 });
    if (!messages || messages.length === 0) {
      await receiver.close();
      await client.close();
      return null;
    }
    const msg = messages[0];
    return {
      receiptHandle: { receiver, message: msg, client },
      body: typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body,
    };
  } catch (err) {
    await receiver.close();
    await client.close();
    throw err;
  }
}

/**
 * Acknowledge (complete) a message after successful processing.
 */
async function ack({ receiver, message, client }) {
  try {
    await receiver.completeMessage(message);
  } finally {
    await receiver.close();
    await client.close();
  }
}

module.exports = { enqueue, receive, ack };
