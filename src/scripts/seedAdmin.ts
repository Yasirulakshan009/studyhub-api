import dns from "node:dns"
dns.setServers(["8.8.8.8", "1.1.1.1"])

import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import { UserModel, UserRole } from "../models/user.model"

const seedAdmin = async () => {
    const { MONGO_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env

    if (!MONGO_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
        console.error("MONGO_URL, ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env")
        process.exit(1)
    }

    await mongoose.connect(MONGO_URL)

    const email = ADMIN_EMAIL.toLowerCase().trim()
    const existing = await UserModel.findOne({ email })

    if (existing) {
        existing.roles = [UserRole.ADMIN]
        await existing.save()
        console.log(`Existing user ${email} is now ADMIN`)
    } else {
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10)
        await UserModel.create({
            name: "Admin",
            email,
            password: hashedPassword,
            roles: [UserRole.ADMIN]
        })
        console.log(`Admin ${email} created`)
    }

    await mongoose.disconnect()

}

seedAdmin().catch((err) => {
    console.error("Seeding failed", err)
    process.exit(1)
})