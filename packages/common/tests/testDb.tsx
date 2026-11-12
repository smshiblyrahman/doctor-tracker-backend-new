import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/** Starts a throwaway MongoDB and connects the default mongoose instance to it. */
export async function startTestDb(): Promise<() => Promise<void>> {
  const server = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await mongoose.connect(server.getUri());
  return async () => {
    await mongoose.disconnect();
    await server.stop();
  };
}

export async function clearDb(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export const TEST_INTERNAL_SECRET = 'test-internal-secret-0123456789abcdef0123';
