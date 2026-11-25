const REQUIRED = ['MONGO_DB', 'JWT_KEY']

/**
 * Refuse to boot when required configuration is missing, instead of failing
 * later (and obscurely) on the first request that needs it.
 */
const validateEnv = () => {
    const missing = REQUIRED.filter((key) => !process.env[key] || !process.env[key].trim())
    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
}

module.exports = { validateEnv }
