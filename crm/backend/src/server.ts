import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { createApp } from "./app";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`CRM API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
