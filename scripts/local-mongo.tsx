/**
 * Zero-install MongoDB for local development: runs a real `mongod` binary
 * (downloaded once by mongodb-memory-server) on localhost:27017 with data
 * persisted to backend/.mongo-data. Skip this if you already run MongoDB.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = Number(process.env.MONGO_PORT ?? 27017);
const DB_PATH = path.resolve(__dirname, '..', '.mongo-data');

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function main() {
  if (await portInUse(PORT)) {
    console.log(`[mongo] Something is already listening on ${PORT}; assuming it is MongoDB and using it.`);
    // Stay alive so `concurrently -k` does not tear down the other processes.
    setInterval(() => undefined, 1 << 30);
    return;
  }

  fs.mkdirSync(DB_PATH, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { port: PORT, ip: '127.0.0.1', dbPath: DB_PATH, storageEngine: 'wiredTiger', launchTimeout: 120_000 },
  });
  console.log(`[mongo] MongoDB ready at ${server.getUri()} (data: ${DB_PATH})`);

  const stop = async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('[mongo] failed to start', err);
  process.exit(1);
});
