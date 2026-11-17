
import { Response } from "express"
import mongoose from "mongoose"
import { AuthRequest } from "../middleware/auth"
import { LikeModel } from "../models/like.model"
import { NoteModel, NoteStatus } from "../models/note.model"


export const toggleLike = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.sub

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const { noteId } = req.params

        if (typeof noteId !== "string" || !mongoose.isValidObjectId(noteId)) {
            return res.status(400).json({ message: "Invalid note id" })
        }

        const note = await NoteModel.findOne({
            _id: noteId,
            status: NoteStatus.APPROVED
        })

        if (!note) {
            return res.status(404).json({ message: "Note not found" })
        }

        const existingLike = await LikeModel.findOne({ userId, noteId })

        let isLiked: boolean

        if (existingLike) {
            await LikeModel.deleteOne({ _id: existingLike._id })
            isLiked = false
        } else {
            await LikeModel.create({ userId, noteId })
            isLiked = true
        }

        const totalLikes = await LikeModel.countDocuments({ noteId })

        return res.status(200).json({
            message: isLiked ? "Note liked successfully" : "Like removed successfully",
            data: {
                noteId,
                isLiked,
                totalLikes
            }
        })
    } catch (error: any) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: "You have already liked this note" })
        }

        console.error(error)
        return res.status(500).json({ message: "Failed to update like" })
    }
}


export const getLikeStatus = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.sub

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const { noteId } = req.params

        if (typeof noteId !== "string" || !mongoose.isValidObjectId(noteId)) {
            return res.status(400).json({ message: "Invalid note id" })
        }

        const note = await NoteModel.findOne({
            _id: noteId,
            status: NoteStatus.APPROVED
        })

        if (!note) {
            return res.status(404).json({ message: "Note not found" })
        }

        const [totalLikes, existingLike] = await Promise.all([
            LikeModel.countDocuments({ noteId }),
            LikeModel.exists({ userId, noteId })
        ])

        return res.status(200).json({
            message: "OK",
            data: {
                noteId,
                totalLikes,
                isLiked: !!existingLike
            }
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: "Failed to load like status" })
    }
}
