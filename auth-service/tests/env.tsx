process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://unused-in-tests';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef012345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef01234';
process.env.INTERNAL_JWT_SECRET = 'test-internal-secret-0123456789abcdef0123';
process.env.ADMIN_EMAIL = 'admin@test.dev';
process.env.ADMIN_PASSWORD = 'Admin@12345';
