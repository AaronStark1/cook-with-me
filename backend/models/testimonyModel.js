const mongoose = require('mongoose')

const TESTIMONY_STATUSES = ['Pending', 'Approved', 'Rejected']

const testimonySchema = new mongoose.Schema({
    // Author fields are derived server-side from the authenticated user.
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    profession: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: TESTIMONY_STATUSES,
        default: 'Pending'
    }
})

module.exports = mongoose.model('testimonies', testimonySchema)
module.exports.TESTIMONY_STATUSES = TESTIMONY_STATUSES
