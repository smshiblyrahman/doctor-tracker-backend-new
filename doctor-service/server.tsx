import { handleShutdown } from '@doctor-tracker/common';
import { env } from './src/config/env';
import { connectDb, disconnectDb } from './src/config/db';
import { createApp } from './src/app';

async function main() {
  await connectDb();
  const server = createApp().listen(env.PORT, () => {
    console.log(`[doctor-service] listening on http://localhost:${env.PORT} (docs: /api-docs)`);
  });
  handleShutdown(server, 'doctor-service', disconnectDb);
}

main().catch((err) => {
  console.error('[doctor-service] failed to start', err);
  process.exit(1);
});
