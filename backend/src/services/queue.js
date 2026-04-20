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
 * Includes a watchdog that recreates the receiver if it goes silent —
 * the Azure Service Bus SDK can silently stop delivering messages without
 * calling processError, so we can't rely on error events alone.
 */
function subscribe(processMessage, processError) {
  let receiver;
  let lastActivityAt = Date.now();
  let watchdogTimer;

  function start() {
    if (receiver) {
      receiver.close().catch(() => {});
    }

    receiver = _client.createReceiver(QUEUE_NAME, { receiveMode: "peekLock" });

    receiver.subscribe({
      processMessage: async (msg) => {
        lastActivityAt = Date.now();
        const body = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;
        await processMessage(body, async () => {
          await receiver.completeMessage(msg);
        });
      },
      processError: async (err) => {
        const error = err.error || err;
        console.error("[queue] Service Bus error — reconnecting in 10s:", error.message);
        scheduleRestart(10000);
        await processError(error);
      },
    });

    lastActivityAt = Date.now();
    console.log("[queue] Service Bus subscription active");
  }

  function scheduleRestart(delayMs) {
    if (watchdogTimer) clearInterval(watchdogTimer);
    setTimeout(() => {
      console.log("[queue] Restarting Service Bus subscription...");
      start();
      startWatchdog();
    }, delayMs);
  }

  function startWatchdog() {
    if (watchdogTimer) clearInterval(watchdogTimer);
    // Check every 30 seconds. If nothing has happened in 90 seconds, recreate the receiver.
    // The SDK can silently stop delivering messages without firing processError,
    // so we can't rely on error events alone.
    watchdogTimer = setInterval(() => {
      const silentMs = Date.now() - lastActivityAt;
      if (silentMs > 90 * 1000) {
        console.warn(`[queue] Watchdog: no activity for ${Math.round(silentMs / 1000)}s — recreating Service Bus subscription`);
        start();
      }
    }, 30 * 1000);
  }

  start();
  startWatchdog();
}

module.exports = { enqueue, subscribe };
