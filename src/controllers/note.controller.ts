import { Response } from "express"
import mongoose from "mongoose"
import { NoteModel} from "../models/note.model"
import { CategoryModel } from "../models/category.model"
import { AuthRequest } from "../middleware/auth"

export const createNote = async ( req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.sub
        if (!userId) {
            return res.status(401).json({ message: "unauthorized" })
        }

        const{ title, description, subject, tags, categoryId } = req.body

        if (typeof title !== "string" || title.trim().length < 5 || title.trim().length > 120) {
            return res.status(400).json({ message: "Title must be 5 to 120 characters" })
        }

        if (typeof description !== "string" || !description.trim() || description.trim().length > 2000) {
            return res.status(400).json({ message: "Description is required (max 2000 characters)" })
        }

        if (subject !== undefined && (typeof subject !== "string" || subject.trim().length > 100)) {
            return res.status(400).json({ message: "subject must be text up to 100 characters" })
        }

        let cleanTags: string[] = []
        if (tags !== undefined) {
            if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
                return res.status(400).json({ message: "Tags must be an array of text" })
            }

            cleanTags = [...new Set(tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean))]

            if (cleanTags.length > 10 || cleanTags.some((t) => t.length > 30)) {
                return res.status(400).json({ message: "Up to 10 tags, each up to 30 characters" })
            }
        }

        if (typeof categoryId !== "string" || !mongoose.isValidObjectId(categoryId)) {
            return res.status(400).json({ message: "A valid categoryId is required" })
        }

        const category = await CategoryModel.findById(categoryId)
        if (!category || !category.isActive) {
            return res.status(400).json({ message: "Category not found or inactive" })
        }

        const note = await NoteModel.create({
            title: title.trim(),
            description: description.trim(),
            subject: subject?.trim() || undefined,
            tags: cleanTags,
            categoryId: category._id,
            uploaderId: userId
        })

        res.status(201).json({ message: "Note submitted for review", data: note })
    }catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to create note" })
    }
}

export const getMyNotes = async (req: AuthRequest, res: Response) => {
    try {
        const notes = await NoteModel.find({ uploaderId: req.user?.sub })
            .populate("categoryId", "name")
            .sort({ createdAt: -1 })
            .limit(100)

        res.status(200).json({ message: "OK", data: notes })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load your notes" })
    }
}