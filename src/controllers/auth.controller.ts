import { Request, Response } from "express"
import bcrypt from "bcryptjs"
import { UserModel } from "../models/user.model"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body

        if(!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required" })
        }

        if (typeof email != "string" || !!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ message: "Invalid email format" })
        }

        if (typeof password != "string" || password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters"})
        }


        const normalizedEmail = email.toLowerCase().trim()
        const extUser = await UserModel.findOne({ email: normalizedEmail })
        if (extUser) {
            return res.status(409).json({ message: "User already exists" })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        await UserModel.create({
            name: String(name).trim(),
            email: normalizedEmail,
            password: hashedPassword
        })

        res.status(201).json({ message: "User registerd successfully" })

    } catch (error) {
        res.status(500).json({ message: "Registration failed"})
    }
}