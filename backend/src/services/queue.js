const { ServiceBusClient } = require("@azure/service-bus");

const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const QUEUE_NAME = process.env.AZURE_SERVICE_BUS_QUEUE_NAME || "onboarding-jobs";

if (!connectionString) throw new Error("AZURE_SERVICE_BUS_CONNECTION_STRING is not set");

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
 * Poll the Service Bus queue for messages.
 * Runs in a tight loop with a short sleep between polls.
 * More reliable than push-based subscribe() which silently drops connections.
 */
async function subscribe(processMessage, processError) {
  const receiver = _client.createReceiver(QUEUE_NAME, { receiveMode: "peekLock" });
  console.log("[queue] Service Bus polling receiver started");

  while (true) {
    try {
      const messages = await receiver.receiveMessages(1, { maxWaitTimeInMs: 5000 });

      if (messages.length === 0) continue;

      const msg = messages[0];
      const body = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;

      try {
        await processMessage(body, async () => {
          await receiver.completeMessage(msg);
        });
      } catch (err) {
        // Processing failed — abandon so Service Bus redelivers (up to max delivery count)
        await receiver.abandonMessage(msg).catch(() => {});
        await processError(err);
      }
    } catch (err) {
      // Receiver error (connection drop etc.) — wait and retry
      console.error("[queue] Service Bus receive error — retrying in 5s:", err.message);
      await processError(err).catch(() => {});
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

module.exports = { enqueue, subscribe };
