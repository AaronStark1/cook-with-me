const { validationResult } = require('express-validator')

/**
 * Ends the request with a structured 400 when any express-validator rule failed.
 * `message` carries the first failure so simple clients can show it directly.
 */
const validate = (req, res, next) => {
    const result = validationResult(req)
    if (result.isEmpty()) {
        return next()
    }
    const errors = result.array().map((e) => ({ field: e.path, message: e.msg }))
    res.status(400).json({ message: errors[0].message, errors })
}

module.exports = validate
