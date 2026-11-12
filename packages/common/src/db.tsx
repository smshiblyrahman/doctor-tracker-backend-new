import type { Mongoose } from 'mongoose';

/** Connects the service's mongoose instance with sane pool/timeout settings. */
export async function connectMongo(mongoose: Mongoose, uri: string, service: string): Promise<void> {
  mongoose.set('strictQuery', true);
  // Retry so a service started alongside MongoDB (docker compose, `npm run dev`) waits for it.
  const maxAttempts = 10;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 20,
        autoIndex: process.env.NODE_ENV !== 'production',
      });
      break;
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      console.warn(`[${service}] MongoDB not reachable (attempt ${attempt}/${maxAttempts}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  console.log(`[${service}] MongoDB connected (${mongoose.connection.name})`);
}

export const objectIdPattern = /^[a-f\d]{24}$/i;
