
import { Request, Response } from "express"
import mongoose from "mongoose"
import { AuthRequest } from "../middleware/auth"
import { UserModel } from "../models/user.model"
import { NoteModel, NoteStatus } from "../models/note.model"
import { LikeModel } from "../models/like.model"

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

        const [items, total, allNoteIds] = await Promise.all([
            NoteModel.find(filter)
                .select("-rejectionReason -file.storageKey")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("categoryId", "name")
                .populate("uploaderId", "name avatarUrl"),

            NoteModel.countDocuments(filter),

            NoteModel.distinct("_id", filter)
        ])

        const userId = (req as AuthRequest).user?.sub
        const pageNoteIds = items.map((note) => note._id)

        const [likeCounts, userLikes] = await Promise.all([
            LikeModel.aggregate([
                {
                    $match: {
                        noteId: { $in: allNoteIds }
                    }
                },
                {
                    $group: {
                        _id: "$noteId",
                        totalLikes: { $sum: 1 }
                    }
                }
            ]),

            userId && pageNoteIds.length > 0
                ? LikeModel.find({
                    noteId: { $in: pageNoteIds },
                    userId
                }).select("noteId")
                : Promise.resolve([])
        ])

        const likeCountMap = new Map(
            likeCounts.map((item) => [
                item._id.toString(),
                item.totalLikes
            ])
        )

        const likedNoteIds = new Set(
            userLikes.map((like) => like.noteId.toString())
        )

        const totalLikes = likeCounts.reduce(
            (sum, item) => sum + item.totalLikes,
            0
        )

        const notesWithLikes = items.map((note) => {
            const noteId = note._id.toString()

            return {
                ...note.toObject(),
                totalLikes: likeCountMap.get(noteId) ?? 0,
                isLiked: likedNoteIds.has(noteId)
            }
        })

        return res.status(200).json({
            message: "OK",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    roles: user.roles,
                    avatarUrl: user.avatarUrl ?? null,
                    totalLikes
                },
                notes: {
                    items: notesWithLikes,
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            message: "Failed to load public profile"
        })
    }
}
