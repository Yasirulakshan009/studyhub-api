
import { Request, Response } from "express"
import mongoose from "mongoose"
import { UserModel } from "../models/user.model"
import { NoteModel, NoteStatus } from "../models/note.model"

export const getPublicUserProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params

        if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid user id" })
        }

        const page = Math.max(
            parseInt(String(req.query.page ?? "1"), 10) || 1,
            1
        )

        const limit = Math.min(
            Math.max(parseInt(String(req.query.limit ?? "12"), 10) || 12, 1),
            50
        )

        const skip = (page - 1) * limit

        const user = await UserModel.findById(id)
            .select("name roles avatarUrl")

        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        const filter = {
            uploaderId: user._id,
            status: NoteStatus.APPROVED
        }

        const [items, total] = await Promise.all([
            NoteModel.find(filter)
                .select("-rejectionReason -file.storageKey")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("categoryId", "name")
                .populate("uploaderId", "name avatarUrl"),

            NoteModel.countDocuments(filter)
        ])

        res.status(200).json({
            message: "OK",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    roles: user.roles,
                    avatarUrl: user.avatarUrl ?? null
                },
                notes: {
                    items,
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load public profile" })
    }
}
