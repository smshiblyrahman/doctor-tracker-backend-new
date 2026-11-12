import './env';
import request from 'supertest';
import { INTERNAL_AUTH_HEADER, signInternalToken } from '@doctor-tracker/common';
import { startTestDb } from '../../packages/common/tests/testDb';
import { createApp } from '../src/app';
import { seedAdmin } from '../src/services/seedAdmin';
import { User } from '../src/models/User';

const app = createApp();
let stopDb: () => Promise<void>;

beforeAll(async () => {
  stopDb = await startTestDb();
  await seedAdmin();
});
afterAll(() => stopDb());

const credentials = { email: 'admin@test.dev', password: 'Admin@12345' };

function cookiesOf(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as unknown;
  return Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
}

describe('auth-service', () => {
  it('stores the seeded admin password as a bcrypt hash', async () => {
    const user = await User.findOne({ email: credentials.email }).select('+password');
    expect(user?.password).toMatch(/^\$2[aby]\$12\$/);
  });

  it('signs in with valid credentials and sets httpOnly cookies', async () => {
    const res = await request(app).post('/api/v1/auth/login').send(credentials).expect(200);
    expect(res.body.data.user).toMatchObject({ email: credentials.email, role: 'admin' });
    expect(res.body.data.user.password).toBeUndefined();
    const cookies = cookiesOf(res);
    expect(cookies.some((c) => c.startsWith('access_token=') && /HttpOnly/i.test(c))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token=') && /HttpOnly/i.test(c))).toBe(true);
  });

  it('rejects a wrong password and an unknown email with the same error', async () => {
    const wrong = await request(app).post('/api/v1/auth/login').send({ ...credentials, password: 'nope' }).expect(401);
    const unknown = await request(app).post('/api/v1/auth/login').send({ ...credentials, email: 'x@test.dev' }).expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.error).toEqual(wrong.body.error);
  });

  it('validates the login body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rotates tokens on refresh and revokes them on logout', async () => {
    const login = await request(app).post('/api/v1/auth/login').send(credentials);
    const cookies = cookiesOf(login);

    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies).expect(200);
    expect(cookiesOf(refreshed).some((c) => c.startsWith('access_token='))).toBe(true);

    await request(app).post('/api/v1/auth/logout').set('Cookie', cookies).expect(200);
    const afterLogout = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies).expect(401);
    expect(afterLogout.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('serves /me only to an authenticated internal caller', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
    const user = await User.findOne({ email: credentials.email });
    const token = signInternalToken({ kind: 'user', sub: String(user!._id) }, process.env.INTERNAL_JWT_SECRET!);
    const res = await request(app).get('/api/v1/auth/me').set(INTERNAL_AUTH_HEADER, token).expect(200);
    expect(res.body.data.user.email).toBe(credentials.email);
  });
});
