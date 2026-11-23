/**
 * One-off migration for user rows created before the security fixes:
 *
 *  - Login no longer accepts plaintext passwords, so any row whose password is
 *    not a bcrypt hash (e.g. a manually seeded admin) would be locked out.
 *    These are hashed in place.
 *  - Roles are now "User" / "Admin". Rows stored as e.g. "admin" are rewritten
 *    to the canonical casing (they would otherwise fail schema validation).
 *
 *   npm run migrate:users
 */
require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const users = require('../models/userModel')

const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$.{53}$/

const run = async () => {
    if (!process.env.MONGO_DB) {
        throw new Error('MONGO_DB is not set')
    }
    await mongoose.connect(process.env.MONGO_DB)

    const all = await users.find().select('+password')
    let hashed = 0
    let roles = 0
    for (const user of all) {
        if (!BCRYPT_HASH.test(user.password)) {
            user.password = await bcrypt.hash(user.password, 10)
            hashed++
        }

        const storedRole = user.get('role', null, { getters: false })
        if (storedRole !== user.role) {
            user.role = user.role   // getter returns the canonical value, setter stores it
            roles++
        }

        if (user.isModified()) {
            await user.save()
        }
    }
    console.log(`Checked ${all.length} users: hashed ${hashed} plaintext password(s), normalised ${roles} role(s).`)
}

run()
    .catch((err) => {
        console.error(err.message)
        process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())
