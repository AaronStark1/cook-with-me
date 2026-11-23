const users = require('../models/userModel')

/**
 * Must run after jwtMiddleware. The role is re-read from the database on every
 * privileged request, so a demoted or deleted user loses access immediately
 * even if their token has not expired yet.
 */
const adminMiddleware = async (req, res, next) => {
    const user = await users.findById(req.userId).select('role')
    if (!user || user.role !== 'Admin') {
        return res.status(403).json({ message: 'Admin access required' })
    }
    next()
}

module.exports = adminMiddleware
