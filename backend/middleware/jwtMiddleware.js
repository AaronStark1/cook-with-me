const jwt = require('jsonwebtoken')

const jwtMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        return res.status(401).json({ message: 'Authorization header missing' })
    }

    const [scheme, token] = authHeader.split(' ')

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Token missing' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_KEY, { algorithms: ['HS256'] })
        req.userId = decoded.userId
        next()
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' })
    }
}

module.exports = jwtMiddleware
