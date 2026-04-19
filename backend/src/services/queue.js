const { ServiceBusClient } = require("@azure/service-bus");

const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const QUEUE_NAME = process.env.AZURE_SERVICE_BUS_QUEUE_NAME || "onboarding-jobs";

if (!connectionString) throw new Error("AZURE_SERVICE_BUS_CONNECTION_STRING is not set");

// Persistent client and sender — reused across all enqueue calls
const _client = new ServiceBusClient(connectionString);
const _sender = _client.createSender(QUEUE_NAME);

/**
 * Enqueue a job. `type` is the job type string; `payload` is an object.
 */
async function enqueue(type, payload) {
  await _sender.sendMessages({
    body: JSON.stringify({ type, payload }),
    applicationProperties: { jobType: type },
  });
}

/**
 * Subscribe to the queue with push-based message delivery.
 * Messages are delivered instantly as they arrive — no polling delay.
 * `processMessage` is called with each message; `processError` handles errors.
 */
function subscribe(processMessage, processError) {
  const receiver = _client.createReceiver(QUEUE_NAME, { receiveMode: "peekLock" });

  receiver.subscribe({
    processMessage: async (msg) => {
      const body = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;
      await processMessage(body, async () => {
        await receiver.completeMessage(msg);
      });
    },
    processError: async (err) => {
      await processError(err.error || err);
    },
  });

  return receiver;
}

module.exports = { enqueue, subscribe };
