const rateLimit = require('express-rate-limit');

// Strict limiter for sensitive auth endpoints (login/register/password-related).
// Keeps brute-force / credential-stuffing attempts in check.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

// General limiter for the rest of the /api surface — generous enough for
// normal usage while still guarding against abuse/scraping.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

module.exports = { authLimiter, apiLimiter };
