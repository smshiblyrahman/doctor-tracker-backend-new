import { handleShutdown } from '@doctor-tracker/common';
import { env } from './src/config/env';
import { createApp } from './src/app';

const server = createApp().listen(env.PORT, () => {
  console.log(`[api-gateway] listening on http://localhost:${env.PORT} (docs: /api-docs)`);
});
handleShutdown(server, 'api-gateway');
