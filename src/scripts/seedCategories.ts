import dns from "node:dns"
if (process.env.USE_CUSTOM_DNS === "true") {
    dns.setServers(["8.8.8.8", "1.1.1.1"])
}

import mongoose from "mongoose"
import { CategoryModel } from "../models/category.model"

const DEFAULT_CATEGORIES = [
    { name: "Programming", description: "Programming languages, frameworks and software development", isSystem: false },
    { name: "Networking", description: "Computer networks, protocols and security", isSystem: false },
    { name: "Databases", description: "SQL, NoSQL and data modelling", isSystem: false },
    { name: "Mathematics", description: "Maths and statistics", isSystem: false },
    { name: "Other", description: "Notes that do not fit another category yet. Admins re-categorize these.", isSystem: true }
]

const seedCategories = async () => {
    const { MONGO_URL } = process.env

    if (!MONGO_URL) {
        console.error("MONGO_URL must be set in .env")
        process.exit(1)
    }

    await mongoose.connect(MONGO_URL)

    for (const item of DEFAULT_CATEGORIES) {
        const result = await CategoryModel.updateOne(
            { name: item.name, parentId: null },
            { $setOnInsert: { description: item.description, isSystem: item.isSystem, isActive: true } },
            { upsert: true }
        )
        console.log(result.upsertedCount ? `Created: ${item.name}` : `Already exists: ${item.name}`)
    }

    await mongoose.disconnect()
}

seedCategories().catch((err) => {
    console.error("Seeding categories failed", err)
    process.exit(1)
})