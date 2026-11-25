const mongoose = require('mongoose')

mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message))
mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'))

/**
 * Connects to MongoDB. Rejects on failure so the caller can fail fast rather
 * than leave the server listening with a dead database.
 */
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_DB, { serverSelectionTimeoutMS: 10000 })
        console.log('MongoDB connected')
    } catch (err) {
        console.error('MongoDB connection error:', err.message)
        throw err
    }
}

module.exports = connectDB
