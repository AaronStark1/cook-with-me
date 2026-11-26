// TRUST_PROXY: behind a host's proxy, the rate limiters must key on the client
// address the proxy appends to X-Forwarded-For, not on the proxy itself, and
// must ignore entries the client wrote further left. Runs in its own process
// (node --test isolates files), so setting the variable here is safe.
process.env.JWT_KEY = 'test-secret-key-that-is-long-enough'
process.env.TRUST_PROXY = '1'

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')

const app = require('../app')
const { trustProxyHops } = require('../config/env')

let server
let base

before(async () => {
    server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

// An invalid body: the registration limiter counts it, then validation rejects
// it with a 400, so nothing reaches the database.
const register = async (forwardedFor) => {
    const res = await fetch(`${base}/api/registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': forwardedFor },
        body: '{}'
    })
    await res.arrayBuffer()
    return res.status
}

describe('trust proxy', () => {
    test('rate limits each forwarded client separately, ignoring spoofed entries', async () => {
        for (let i = 0; i < 10; i++) assert.equal(await register('198.51.100.1'), 400)
        assert.equal(await register('198.51.100.1'), 429)

        // A client-written entry to the left of the proxy's does not earn a new bucket.
        assert.equal(await register('203.0.113.99, 198.51.100.1'), 429)

        // A different client is unaffected.
        assert.equal(await register('198.51.100.2'), 400)
    })

    test('TRUST_PROXY accepts a hop count and refuses anything else', () => {
        const saved = process.env.TRUST_PROXY
        try {
            for (const [value, hops] of [['', 0], ['0', 0], [' 2 ', 2]]) {
                process.env.TRUST_PROXY = value
                assert.equal(trustProxyHops(), hops)
            }
            for (const value of ['true', '-1', '1.5', 'loopback']) {
                process.env.TRUST_PROXY = value
                assert.throws(trustProxyHops, /TRUST_PROXY must be a whole number/)
            }
        } finally {
            process.env.TRUST_PROXY = saved
        }
    })
})
