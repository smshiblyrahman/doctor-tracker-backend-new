import './env';

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Server } from 'node:http';
import { INTERNAL_AUTH_HEADER, verifyInternalToken } from '@doctor-tracker/common';
import { createApp } from '../src/app';

const app = createApp();
let upstream: Server;

/** Fake doctor-service that echoes what the gateway forwarded. */
beforeAll((done) => {
  const fake = express();
  fake.use(express.json());
  fake.all('/{*path}', (req, res) => {
    const header = req.headers[INTERNAL_AUTH_HEADER] as string | undefined;
    res.json({
      path: req.originalUrl,
      method: req.method,
      body: req.body,
      identity: header ? verifyInternalToken(header, process.env.INTERNAL_JWT_SECRET!) : null,
    });
  });
  upstream = fake.listen(45102, '127.0.0.1', done);
});
afterAll((done) => {
  upstream.close(() => done());
});

function accessToken(overrides: Record<string, unknown> = {}, options: jwt.SignOptions = {}) {
  return jwt.sign({ email: 'admin@test.dev', role: 'admin', name: 'Admin', ...overrides }, process.env.JWT_ACCESS_SECRET!, {
    subject: 'user-1',
    issuer: 'doctor-tracker',
    audience: 'doctor-tracker-client',
    expiresIn: 60,
    ...options,
  });
}

describe('api-gateway', () => {
  it('rejects unauthenticated requests before they reach a service', async () => {
    const res = await request(app).get('/api/v1/doctors').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('ignores a forged internal header from the client', async () => {
    await request(app).get('/api/v1/doctors').set(INTERNAL_AUTH_HEADER, 'forged').expect(401);
  });

  it('reports expired access tokens distinctly so the client can refresh', async () => {
    const expired = accessToken({}, { expiresIn: -10 });
    const res = await request(app).get('/api/v1/doctors').set('Cookie', `access_token=${expired}`).expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('forbids non-admin roles', async () => {
    await request(app).get('/api/v1/doctors').set('Cookie', `access_token=${accessToken({ role: 'viewer' })}`).expect(403);
  });

  it('proxies path, query and body with a verified internal identity', async () => {
    const res = await request(app)
      .post('/api/v1/doctors/abc/patients?x=1')
      .set('Cookie', `access_token=${accessToken()}`)
      .send({ name: 'Pat' })
      .expect(200);
    expect(res.body).toMatchObject({
      path: '/api/v1/doctors/abc/patients?x=1',
      method: 'POST',
      body: { name: 'Pat' },
      identity: { kind: 'user', sub: 'user-1', role: 'admin' },
    });
  });

  it('returns a JSON 502 when a service is down', async () => {
    const res = await request(app).get('/api/v1/patients').set('Cookie', `access_token=${accessToken()}`).expect(502);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
