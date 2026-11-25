const testimony = require('../models/testimonyModel')
const users = require('../models/userModel')

exports.addTestimony = async (req, res) => {
    const { message, profession } = req.body

    // Author details come from the authenticated account, never from the client.
    const author = await users.findById(req.userId)
    if (!author) {
        return res.status(401).json({ message: 'Invalid or expired token' })
    }

    const existingTestimony = await testimony.findOne({ userId: author._id })
    if (existingTestimony) {
        return res.status(409).json({ message: 'Testimony already exists' })
    }

    const newTestimony = await testimony.create({
        userId: author._id,
        username: author.username,
        email: author.email,
        message,
        profession
    })

    res.status(201).json({ message: 'Testimony Added Successfully...', newTestimony })
}

// Admin only: includes pending and rejected entries.
exports.getTestimony = async (req, res) => {
    const allTestimony = await testimony.find()
    res.status(200).json({ message: 'Testimonies Fetched Successfully...', allTestimony })
}

// Public: approved entries only, without contact details.
exports.getApprovedTestimony = async (req, res) => {
    const approved = await testimony.find({ status: 'Approved' }).select('username profession message')
    res.status(200).json({ message: 'Approved testimonies fetched', approved })
}

exports.updateTestimony = async (req, res) => {
    const updatedData = await testimony.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { returnDocument: 'after', runValidators: true }
    )
    if (!updatedData) {
        return res.status(404).json({ message: 'Testimony not found' })
    }
    res.status(200).json({ message: 'Updated Successfully...', updatedData })
}
