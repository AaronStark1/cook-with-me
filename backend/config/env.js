const REQUIRED = ['MONGO_DB', 'JWT_KEY']

/**
 * How many reverse proxies sit in front of the app (a host's load balancer, for
 * one), from TRUST_PROXY. Express needs the count to take the client's address
 * from X-Forwarded-For; without it every request seems to come from the proxy,
 * so all visitors share one rate-limit bucket. Unset or 0 trusts no proxy.
 * `true` is refused: it would trust the leftmost entry, which the client writes.
 */
const trustProxyHops = () => {
    const raw = (process.env.TRUST_PROXY || '').trim()
    if (!raw) return 0
    if (!/^\d+$/.test(raw)) {
        throw new Error(`TRUST_PROXY must be a whole number of proxy hops, such as 1 (got "${raw}")`)
    }
    return Number(raw)
}

/**
 * Refuse to boot when required configuration is missing, instead of failing
 * later (and obscurely) on the first request that needs it.
 */
const validateEnv = () => {
    const missing = REQUIRED.filter((key) => !process.env[key] || !process.env[key].trim())
    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
    trustProxyHops()
}

module.exports = { validateEnv, trustProxyHops }
