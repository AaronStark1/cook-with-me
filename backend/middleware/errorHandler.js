const { STATUS_CODES } = require('http')

const notFound = (req, res) => {
    res.status(404).json({ message: 'Route not found' })
}

// Express 5 forwards rejected promises from async handlers here, so controllers
// do not need their own try/catch.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err)
    }

    let status = 500
    let message = 'Internal server error'

    if (err.name === 'ValidationError' && err.errors) {
        status = 400
        message = Object.values(err.errors).map((e) => e.message).join(', ')
    } else if (err.name === 'CastError') {
        status = 400
        message = `Invalid ${err.path}`
    } else if (err.code === 11000) {
        status = 409
        message = 'Duplicate value'
    } else if (err.type === 'entity.parse.failed') {
        status = 400
        message = 'Invalid JSON body'
    } else if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
        status = err.status
        message = STATUS_CODES[status] || 'Bad request'
    }

    if (status >= 500) {
        console.error(err)
    }

    res.status(status).json({ message })
}

module.exports = { notFound, errorHandler }
