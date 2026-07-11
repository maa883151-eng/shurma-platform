// Shared test environment. Runs before each test file.
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
// DATABASE_URL is never used — tests mock src/config/db — but pg's Pool
// constructor runs at import time, so give it something parseable.
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
