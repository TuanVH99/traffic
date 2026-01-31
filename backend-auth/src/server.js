const { createApp } = require("./app");
const { connectDb } = require("./config/db");
const { env, validateEnv } = require("./config/env");
const dns = require('node:dns/promises');
dns.setServers(["1.1.1.1"]);

async function bootstrap() {
  validateEnv();

  await connectDb();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[API] Listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("[BOOTSTRAP] Failed:", err);
  process.exit(1);
});
