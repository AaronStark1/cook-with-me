require('dotenv').config()
const { validateEnv } = require('./config/env')

try {
    validateEnv()
} catch (err) {
    console.error(err.message)
    process.exit(1)
}

const connectDB = require('./config/db')
const app = require('./app')

const PORT = process.env.PORT || 3000

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`server runs on port ${PORT}`)
        })
    })
    .catch(() => process.exit(1))
