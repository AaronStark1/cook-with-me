const users = require('../models/userModel')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

exports.registerUser = async (req, res) => {
    const { username, email, password } = req.body
    try {
        const existingUser = await users.findOne({ email })
        if (existingUser) {
            res.status(402).json({ message: "user email exist" })
        }
        else {
            const encryptedPassword = await bcrypt.hash(password, 10)
            console.log(encryptedPassword);

            const newUser = new users({ username, email, password: encryptedPassword })
            await newUser.save()
            res.status(200).json({ message: "user registration successful", newUser })
        }
    }
    catch (err) {
        console.log("Registration error");

    }
}

exports.loginUser = async (req, res) => {
    const { email, password } = req.body
    try {
        const existingUser = await users.findOne({ email })
        if (!existingUser) {
            return res.status(402).json({ message: "User not found" })
        }
        const userPassword = await bcrypt.compare(password, existingUser.password)
        if (!userPassword && existingUser.password !== password) {
            return res.status(401).json({ message: "Password mismatch" })
        }
        const token = jwt.sign({ userId: existingUser._id }, process.env.JWT_KEY)
        console.log(token);

        res.status(200).json({
            message: "Login Success",
            user: existingUser,
            token
        })
    }
    catch (err) {
        console.log("Login error");

    }
}

exports.getAllUsers = async (req, res) => {
    try {
        const getUsers=await users.find({role:"User"})
        res.status(200).json(getUsers)
    } catch (err) {
        console.log("Login error");
        res.status(500).json(err)
    }
}