require("dotenv").config();
const { registerWebhook } = require("../src/services/acrobat-sign");

const WEBHOOK_URL = "https://abti-api.azurewebsites.net/acrobat/webhook";

(async () => {
  try {
    console.log("Registering Acrobat Sign webhook:", WEBHOOK_URL);
    const id = await registerWebhook(WEBHOOK_URL);
    console.log("Webhook registered successfully. ID:", id);
  } catch (err) {
    console.error("Failed to register webhook:", err.response?.data || err.message);
    process.exit(1);
  }
})();
