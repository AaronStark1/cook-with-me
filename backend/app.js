const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const route = require('./router/route')
const { apiLimiter } = require('./middleware/rateLimiters')
const { notFound, errorHandler } = require('./middleware/errorHandler')
const { trustProxyHops } = require('./config/env')

// Treat any object in a query filter as a literal value, so request bodies such
// as {"email": {"$ne": null}} cannot be used as query operators.
mongoose.set('sanitizeFilter', true)

const app = express()

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

app.disable('x-powered-by')

// Behind a host's proxy, req.ip (which keys the rate limiters) is the client's
// address only if Express knows how many proxy hops to skip.
const proxyHops = trustProxyHops()
if (proxyHops > 0) app.set('trust proxy', proxyHops)
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting']
app.get('/health', (req, res) => {
    const { readyState } = mongoose.connection
    const ok = readyState === 1
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'unavailable', db: DB_STATES[readyState] })
})

app.use('/api', apiLimiter)
app.use(route)

app.use(notFound)
app.use(errorHandler)

module.exports = app
