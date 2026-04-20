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
 * Automatically reconnects if the Service Bus connection drops.
 * `processMessage` is called with each message; `processError` handles errors.
 */
function subscribe(processMessage, processError) {
  let receiver;

  function start() {
    if (receiver) {
      receiver.close().catch(() => {});
    }

    receiver = _client.createReceiver(QUEUE_NAME, { receiveMode: "peekLock" });

    receiver.subscribe({
      processMessage: async (msg) => {
        const body = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;
        await processMessage(body, async () => {
          await receiver.completeMessage(msg);
        });
      },
      processError: async (err) => {
        const error = err.error || err;
        console.error("[queue] Service Bus error — reconnecting in 10s:", error.message);
        setTimeout(start, 10000);
        await processError(error);
      },
    });

    console.log("[queue] Service Bus subscription active");
  }

  start();
}

module.exports = { enqueue, subscribe };
