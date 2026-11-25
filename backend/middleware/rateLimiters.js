const { rateLimit } = require('express-rate-limit')

const WINDOW_MS = 15 * 60 * 1000

const build = (limit, extra = {}) =>
    rateLimit({
        windowMs: WINDOW_MS,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { message: 'Too many requests, please try again later' },
        ...extra
    })

module.exports = {
    // Generous ceiling for every API route.
    apiLimiter: build(300),
    // Brute-force protection; only failed logins count against the limit.
    loginLimiter: build(10, { skipSuccessfulRequests: true }),
    registrationLimiter: build(10)
}
