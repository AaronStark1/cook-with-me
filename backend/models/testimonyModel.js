const mongoose = require('mongoose')

const testimonySchema = new mongoose.Schema({
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
        default: "Pending"
    }


})

module.exports = mongoose.model('testimonies', testimonySchema)