import { Request, Response } from "express"
import bcrypt from "bcryptjs"
import { UserModel, UserRole } from "../models/user.model"
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../util/jwt"
import { AuthRequest } from "../middleware/auth"
import { createHash, randomBytes } from "node:crypto"
import { sendPasswordResetEmail } from "../services/email.service"
import { allowRequest } from "../util/rateLimit"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RESET_TOKEN_MINUTES = 30
const FORGOT_MESSAGE = "If an account with that email exists, we have sent a password reset link."

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body

        if(!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required" })
        }

        if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
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

        res.status(201).json({ message: "User registered successfully" })

    } catch (error: any) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: "User already exists" })
        }
        console.error(error)
        res.status(500).json({ message: "Registration failed" })
    }
}

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body

        if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
            return res.status(400).json({ message: "Email and password are required" })
        }

        const user = await UserModel.findOne({ email: email.toLowerCase().trim() })
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" })
        }

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
            return res.status(401).json({ message: "Invalid credentials" })
        }

        res.status(200).json({
            message: "Login successful",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    roles: user.roles
                },
                accessToken: signAccessToken(user),
                refreshToken: signRefreshToken(user)
            }
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Login failed" })
    }
}

export const refresh = async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body

        if (typeof refreshToken !== "string" || !refreshToken) {
            return res.status(400).json({ message: "Refresh token is required" })
        }

        const payload = verifyRefreshToken(refreshToken)
        const user = await UserModel.findById(payload.sub)
        if (!user) {
            return res.status(403).json({ message: "Invalid token" })
        }

        res.status(200).json({
            message: "Token refreshed",
            data: { accessToken: signAccessToken(user) }
        })
    } catch (error) {
        res.status(403).json({ message: "Invalid or expired refresh token" })
    }
}

export const me = async (req: AuthRequest, res: Response) => {
    try {
        const user = await UserModel.findById(req.user?.sub).select("-password")
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        res.status(200).json({
            message: "OK",
            data: { id: user._id, name: user.name, email: user.email, roles: user.roles }
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load profile" })
    }
}

export const updateMyProfile = async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, currentPassword, newPassword } = req.body

        const wantsName = name !== undefined
        const wantsEmail = email !== undefined
        const wantsPassword = newPassword !== undefined

        if (!wantsName && !wantsEmail && ! wantsPassword) {
            return res.status(400).json({ message: "Nothing to update" })
        }

        const user = await UserModel.findById(req.user?.sub)
        if(!user){
            return res.status(404).json({ message: "User not found" })
        }
        
        if (wantsName) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({ message: "Name cannot be empty" })
            }
            user.name = name.trim()
        }

        if (wantsEmail || wantsPassword) {
            if (typeof currentPassword !== "string" || !currentPassword) {
                return res.status(400).json({ message: "Current password is required to change email or password" })
            }
            const isValid = await bcrypt.compare(currentPassword, user.password)
            if (!isValid) {
                return res.status(401).json({ message: "Current password is incorrect" })
            }
        }

        if (wantsEmail) {
            if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
                return res.status(400).json({ message: "Invalid email format" })
            }
            const normalizedEmail = email.toLowerCase().trim()
            if (normalizedEmail !== user.email) {
                const taken = await UserModel.findOne({ email: normalizedEmail })
                if (taken) {
                    return res.status(409).json({ message: "Email already in use" })
                }
                user.email = normalizedEmail
            }
        }

        if (wantsPassword) {
            if (typeof newPassword !== "string" || newPassword.length < 6) {
                return res.status(400).json({ message: "New password must be at least 6 characters" })
            }
            if (newPassword === currentPassword) {
                return res.status(400).json({ message: "New password must be different from current password" })
            }
            const salt = await bcrypt.genSalt(10)
            user.password = await bcrypt.hash(newPassword, salt)
        }

        await user.save()

        res.status(200).json({
            message: "Profile updated successfully",
            data: { id: user._id, name: user.name, email: user.email, roles: user.roles }
        })
    } catch (error: any) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: "Email already in use" })
        }
        console.error(error)
        res.status(500).json({ message: "Failed to update profile" })
    }
}

export const registerAdmin = async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required" })
        }
        if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ message: "Invalid email format" })
        }
        if (typeof password !== "string" || password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" })
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
            password: hashedPassword,
            roles: [UserRole.ADMIN]
        })

        res.status(201).json({ message: "Admin registered successfully" })
    } catch (error: any) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: "User already exists" })
        }
        console.error(error)
        res.status(500).json({ message: "Admin registration failed" })
    }
}

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body

        if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ message: "Enter a valid email address" })
        }

        const normalizedEmail = email.toLowerCase().trim()
        const windowMs = 15 * 60_000

        if (
            !allowRequest(`forgot-ip:${req.ip ?? "unknown"}`, 10, windowMs) ||
            !allowRequest(`forgot-email:${normalizedEmail}`, 3, windowMs)
        ) {
            return res.status(429).json({ message: "Too many requests. Please try again later." })
        }

        const user = await UserModel.findOne({ email: normalizedEmail })

        if (user) {
            const token = randomBytes(32).toString("hex")

            await UserModel.updateOne(
                { _id: user._id },
                {
                    $set: {
                        passwordResetTokenHash: hashToken(token),
                        passwordResetExpires: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000)
                    }
                },
                { timestamps: false }
            )

            const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "")

            sendPasswordResetEmail(
                { email: user.email, name: user.name },
                `${clientUrl}/reset-password?token=${token}`
            ).catch((error) => {
                console.error("Failed to send reset email:", error instanceof Error ? error.message : error)
            })
        }

        res.status(200).json({ message: FORGOT_MESSAGE })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Could not process your request" })
    }
}

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body

        if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
            return res.status(400).json({ message: "This reset link is invalid or has expired" })
        }

        if (typeof newPassword !== "string" || newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" })
        }

        if (!allowRequest(`reset-ip:${req.ip ?? "unknown"}`, 10, 15 * 60_000)) {
            return res.status(429).json({ message: "Too many attempts. Please try again later." })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(newPassword, salt)

        const user = await UserModel.findOneAndUpdate(
            {
                passwordResetTokenHash: hashToken(token),
                passwordResetExpires: { $gt: new Date() }
            },
            {
                $set: { password: hashedPassword },
                $unset: { passwordResetTokenHash: "", passwordResetExpires: "" }
            }
        )

        if (!user) {
            return res.status(400).json({ message: "This reset link is invalid or has expired" })
        }

        res.status(200).json({ message: "Your password has been updated. You can now log in." })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Could not reset your password" })
    }
}