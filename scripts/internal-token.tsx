/**
 * Prints a service-identity internal token for calling a service directly from its
 * own Swagger UI (Authorize → InternalAuth). Valid for 1 hour.
 *
 *   npm run token            # service identity (can call internal endpoints)
 *   npm run token -- user    # admin user identity
 */
import { config } from 'dotenv';
import path from 'node:path';
import { signInternalToken } from '@doctor-tracker/common';

config({ path: path.resolve(__dirname, '..', 'doctor-service', '.env') });
const secret = process.env.INTERNAL_JWT_SECRET;
if (!secret) {
  console.error('INTERNAL_JWT_SECRET not found (copy doctor-service/.env.example to .env first).');
  process.exit(1);
}

const asUser = process.argv[2] === 'user';
const token = signInternalToken(
  asUser
    ? { kind: 'user', sub: '000000000000000000000000', email: 'admin@doctortracker.dev', role: 'admin', name: 'Swagger' }
    : { kind: 'service', sub: 'swagger-cli' },
  secret,
  3600,
);
console.log(token);
