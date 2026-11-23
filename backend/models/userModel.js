const mongoose = require('mongoose')

const ROLES = ['User', 'Admin']

// Canonical casing is "User" / "Admin". Legacy rows stored as "admin" are
// normalised on read and write.
const normalizeRole = (value) => {
    if (typeof value !== 'string') return value
    return ROLES.find((role) => role.toLowerCase() === value.trim().toLowerCase()) ?? value
}

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        select: false   // opt in with .select('+password') (login only)
    },
    role: {
        type: String,
        enum: ROLES,
        default: 'User',
        set: normalizeRole,
        get: normalizeRole
    },
    profilePic: {
        type: String
    }
}, {
    toJSON: {
        getters: true,
        versionKey: false,
        transform: (doc, ret) => {
            delete ret.password
            delete ret.id
            return ret
        }
    }
})

const users = mongoose.model('users', userSchema)
module.exports = users
module.exports.ROLES = ROLES
