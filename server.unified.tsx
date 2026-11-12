/**
 * Unified Runner for single-service deployment (Render, Heroku, etc.).
 * Starts Auth, Doctor, Patient, and Dashboard services as child processes/servers
 * and runs API Gateway to expose the unified API.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const baseMongo = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
function getDbUri(dbName: string) {
  if (baseMongo.includes('mongodb+srv://') || baseMongo.includes('mongodb://')) {
    const url = new URL(baseMongo);
    url.pathname = `/${dbName}`;
    url.searchParams.set('retryWrites', 'true');
    url.searchParams.set('w', 'majority');
    return url.toString();
  }
  return `${baseMongo}/${dbName}`;
}

const sharedEnv = {
  ...process.env,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me-0123456789abcdef',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-0123456789abcdef',
  INTERNAL_JWT_SECRET: process.env.INTERNAL_JWT_SECRET || 'dev-internal-secret-change-me-0123456789abcd',
  AUTH_SERVICE_URL: 'http://127.0.0.1:5001',
  DOCTOR_SERVICE_URL: 'http://127.0.0.1:5002',
  PATIENT_SERVICE_URL: 'http://127.0.0.1:5003',
  DASHBOARD_SERVICE_URL: 'http://127.0.0.1:5004',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000,https://doctor-tracker-frontend-new.vercel.app',
  COOKIE_SECURE: process.env.COOKIE_SECURE || 'true',
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || 'none',
  NODE_ENV: process.env.NODE_ENV || 'production',
};

const rootDir = process.cwd();

const services = [
  {
    name: 'auth-service',
    port: 5001,
    cwd: path.resolve(rootDir, 'auth-service'),
    env: {
      ...sharedEnv,
      PORT: '5001',
      MONGO_URI: process.env.AUTH_MONGO_URI || getDbUri('doctor_tracker_auth'),
    },
  },
  {
    name: 'patient-service',
    port: 5003,
    cwd: path.resolve(rootDir, 'patient-service'),
    env: {
      ...sharedEnv,
      PORT: '5003',
      MONGO_URI: process.env.PATIENTS_MONGO_URI || getDbUri('doctor_tracker_patients'),
    },
  },
  {
    name: 'doctor-service',
    port: 5002,
    cwd: path.resolve(rootDir, 'doctor-service'),
    env: {
      ...sharedEnv,
      PORT: '5002',
      MONGO_URI: process.env.DOCTORS_MONGO_URI || getDbUri('doctor_tracker_doctors'),
    },
  },
  {
    name: 'dashboard-service',
    port: 5004,
    cwd: path.resolve(rootDir, 'dashboard-service'),
    env: {
      ...sharedEnv,
      PORT: '5004',
    },
  },
];

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const nodeBinary = process.execPath || 'node';

function startService(svc: { name: string; cwd: string; env: NodeJS.ProcessEnv }) {
  console.log(`[runner] Launching ${svc.name}...`);
  const child = spawn(nodeBinary, ['dist/server.js'], {
    cwd: svc.cwd,
    env: svc.env,
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    console.error(`[runner] Error in ${svc.name}:`, err);
  });

  child.on('exit', (code) => {
    console.log(`[runner] ${svc.name} exited with code ${code}`);
  });

  return child;
}

async function main() {
  console.log('[runner] Bootstrapping unified microservices architecture on single Render service...');

  // Start internal services with slight delays to let DB connections settle
  for (const svc of services) {
    startService(svc);
    await delay(1200);
  }

  // Wait 2 seconds before bringing up gateway so downstreams respond to aggregate swagger
  await delay(2000);

  console.log('[runner] Launching api-gateway on public PORT:', process.env.PORT || '10000');
  const gateway = spawn(nodeBinary, ['dist/server.js'], {
    cwd: path.resolve(rootDir, 'api-gateway'),
    env: {
      ...sharedEnv,
      PORT: process.env.PORT || '10000',
    },
    stdio: 'inherit',
  });

  gateway.on('exit', (code) => {
    console.error(`[runner] Gateway exited with code ${code}`);
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error('[runner] Failed to run all-in-one backend:', err);
  process.exit(1);
});
