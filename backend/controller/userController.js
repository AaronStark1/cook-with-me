const mongoose = require('mongoose')
const users = require('../models/userModel')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'

// Compared against when the email is unknown, so response time does not reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10)

const toPublicUser = (user) => ({
    _id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    profilePic: user.profilePic
})

const signToken = (user) =>
    jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_KEY, {
        expiresIn: TOKEN_EXPIRES_IN,
        algorithm: 'HS256'
    })

exports.registerUser = async (req, res) => {
    const { username, email, password } = req.body

    const existingUser = await users.findOne({ email })
    if (existingUser) {
        return res.status(409).json({ message: 'Email is already registered' })
    }

    const encryptedPassword = await bcrypt.hash(password, 10)
    // `role` is never read from the request; new accounts are always plain users.
    const newUser = await users.create({ username, email, password: encryptedPassword })

    res.status(201).json({ message: 'user registration successful', user: toPublicUser(newUser) })
}

exports.loginUser = async (req, res) => {
    const { email, password } = req.body

    const existingUser = await users.findOne({ email }).select('+password')
    const passwordMatches = await bcrypt.compare(password, existingUser ? existingUser.password : DUMMY_HASH)

    // One generic message for both cases, to avoid account enumeration.
    if (!existingUser || !passwordMatches) {
        return res.status(401).json({ message: 'Invalid credentials' })
    }

    res.status(200).json({
        message: 'Login Success',
        user: toPublicUser(existingUser),
        token: signToken(existingUser)
    })
}

exports.updateProfile = async (req, res) => {
    const { username, email } = req.body

    // sanitizeFilter is on, so server-built operators must be marked as trusted
    const emailTaken = await users.findOne({ email, _id: mongoose.trusted({ $ne: req.userId }) })
    if (emailTaken) {
        return res.status(409).json({ message: 'Email is already registered' })
    }

    const updated = await users.findByIdAndUpdate(
        req.userId,
        { username, email },
        { returnDocument: 'after', runValidators: true }
    )
    if (!updated) {
        return res.status(404).json({ message: 'User not found' })
    }

    res.status(200).json({ message: 'Profile updated', user: toPublicUser(updated) })
}

exports.getAllUsers = async (req, res) => {
    const allUsers = await users.find({ role: 'User' }).select('username email profilePic role')
    res.status(200).json(allUsers)
}
