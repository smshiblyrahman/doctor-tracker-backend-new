import { handleShutdown } from '@doctor-tracker/common';
import { env } from './src/config/env';
import { connectDb, disconnectDb } from './src/config/db';
import { createApp } from './src/app';
import { seedAdmin } from './src/services/seedAdmin';

async function main() {
  await connectDb();
  await seedAdmin();
  const server = createApp().listen(env.PORT, () => {
    console.log(`[auth-service] listening on http://localhost:${env.PORT} (docs: /api-docs)`);
  });
  handleShutdown(server, 'auth-service', disconnectDb);
}

main().catch((err) => {
  console.error('[auth-service] failed to start', err);
  process.exit(1);
});
