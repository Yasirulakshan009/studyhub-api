import { Request, Response } from "express"
import mongoose from "mongoose"
import { NoteModel, NoteStatus } from "../models/note.model"
import { CategoryModel } from "../models/category.model"
import { UserRole } from "../models/user.model"
import { AuthRequest } from "../middleware/auth"
import { parseNoteFields } from "../validators/note.validator"
import { saveNoteFile, deleteNoteFile, createDownloadUrl, type StoredFile } from "../services/storage.service"

const getPagination = (query: any, defaultLimit: number) => {
    const page = Math.max(parseInt(String(query.page ?? "1"), 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(String(query.limit ?? String(defaultLimit)), 10) || defaultLimit, 1), 50)
    return { page, limit, skip: (page - 1) * limit }
}

export const createNote = async (req: AuthRequest, res: Response) => {
    let storedFile: StoredFile | null = null

    try {
        const userId = req.user?.sub
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        if (!req.file) {
            return res.status(400).json({ message: "A PDF file is required" })
        }

        if (req.body.ownershipConfirmed !== "true") {
            return res.status(400).json({
                message: "You must confirm that you own this note or have permission to share it"
            })
        }

        const body = { ...req.body }
        if (typeof body.tags === "string") {
            body.tags = body.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
        }

        const { data, error } = parseNoteFields(body, "create")
        if (error || !data) {
            return res.status(400).json({ message: error })
        }

        const category = await CategoryModel.findById(data.categoryId)
        if (!category || !category.isActive) {
            return res.status(400).json({ message: "Category not found or inactive" })
        }

        storedFile = await saveNoteFile(req.file, userId)

        const note = await NoteModel.create({
            title: data.title,
            description: data.description,
            subject: data.subject || undefined,
            tags: data.tags ?? [],
            categoryId: category._id,
            uploaderId: userId,
            ownershipConfirmed: true,
            file: storedFile
        })

        res.status(201).json({ message: "Note submitted for review", data: note })
    } catch (error: any) {
        if (storedFile) {
            try {
                await deleteNoteFile(storedFile.storageKey)
            } catch (cleanupError) {
                console.error(cleanupError)
            }
        }

        if (error?.message === "INVALID_PDF") {
            return res.status(400).json({ message: "File is not a valid PDF" })
        }

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

export const updateNote = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.sub
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const { id } = req.params
        if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid note id" })
        }

        const { data, error } = parseNoteFields(req.body, "update")
        if (error || !data) {
            return res.status(400).json({ message: error })
        }
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ message: "Nothing to update" })
        }

        const note = await NoteModel.findById(id)
        if (!note) {
            return res.status(404).json({ message: "Note not found" })
        }

        const isAdmin = req.user?.roles?.includes(UserRole.ADMIN) ?? false
        const isOwner = note.uploaderId.toString() === userId
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: "You can only modify your own notes" })
        }

        if (data.categoryId !== undefined) {
            const category = await CategoryModel.findById(data.categoryId)
            if (!category || !category.isActive) {
                return res.status(400).json({ message: "Category not found or inactive" })
            }
            note.categoryId = category._id
        }

        if (data.title !== undefined) note.title = data.title
        if (data.description !== undefined) note.description = data.description
        if (data.subject !== undefined) note.subject = data.subject || undefined
        if (data.tags !== undefined) note.tags = data.tags

        if (!isAdmin) {
            note.status = NoteStatus.PENDING
            note.rejectionReason = undefined
        }

        await note.save()

        res.status(200).json({
            message: isAdmin ? "Note updated successfully" : "Note updated and sent for review again",
            data: note
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to update note" })
    }
}

export const deleteNote = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.sub
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const { id } = req.params
        if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid note id" })
        }

        const note = await NoteModel.findById(id)
        if (!note) {
            return res.status(404).json({ message: "Note not found" })
        }

        const isAdmin = req.user?.roles?.includes(UserRole.ADMIN) ?? false
        const isOwner = note.uploaderId.toString() === userId
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: "You can only modify your own notes" })
        }

        const storageKey = note.file?.storageKey

        await note.deleteOne()

        if (storageKey) {
            try {
                await deleteNoteFile(storageKey)
            } catch (cleanupError) {
                console.error("Failed to remove file from storage:", cleanupError)
            }
        }

        res.status(200).json({ message: "Note deleted successfully" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to delete note" })
    }
}

export const getPendingNotes = async (req: AuthRequest, res: Response) => {
    try {
        const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1)
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "10"), 10) || 10, 1), 50)
        const skip = (page - 1) * limit

        const filter = { status: NoteStatus.PENDING }

        const [items, total] = await Promise.all([
            NoteModel.find(filter)
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(limit)
                .populate("categoryId", "name")
                .populate("uploaderId", "name email"),
            NoteModel.countDocuments(filter)
        ])

        res.status(200).json({
            message: "OK",
            data: { items, page, limit, total, totalPages: Math.ceil(total / limit) }
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load pending notes" })
    }
}

export const reviewNote = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params
        if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid note id" })
        }

        const { status, rejectionReason, categoryId } = req.body ?? {}

        if (status !== NoteStatus.APPROVED && status !== NoteStatus.REJECTED) {
            return res.status(400).json({ message: "Status must be APPROVED or REJECTED" })
        }

        let reason: string | undefined
        if (status === NoteStatus.REJECTED) {
            if (typeof rejectionReason !== "string" || rejectionReason.trim().length < 3 || rejectionReason.trim().length > 300) {
                return res.status(400).json({ message: "A rejection reason (3 to 300 characters) is required" })
            }
            reason = rejectionReason.trim()
        }

        const note = await NoteModel.findById(id)
        if (!note) {
            return res.status(404).json({ message: "Note not found" })
        }

        if (categoryId !== undefined) {
            if (typeof categoryId !== "string" || !mongoose.isValidObjectId(categoryId)) {
                return res.status(400).json({ message: "A valid categoryId is required" })
            }

            const category = await CategoryModel.findById(categoryId)
            if (!category || !category.isActive) {
                return res.status(400).json({ message: "Category not found or inactive" })
            }
            note.categoryId = category._id
        }

        note.status = status
        note.rejectionReason = reason

        await note.save()

        res.status(200).json({
            message: status === NoteStatus.APPROVED ? "Note approved" : "Note rejected",
            data: note
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to review note" })
    }
}

export const listNotes = async (req: Request, res: Response) => {
    try {
        const { q, categoryId, sort } = req.query
        const { page, limit, skip } = getPagination(req.query, 12)

        const filter: Record<string, any> = { status: NoteStatus.APPROVED }

        let keyword = ""
        if (q !== undefined) {
            if (typeof q !== "string" || q.trim().length > 100) {
                return res.status(400).json({ message: "Search text must be up to 100 characters" })
            }
            keyword = q.trim()
            if (keyword) {
                filter.$text = { $search: keyword }
            }
        }

        if (categoryId !== undefined) {
            if (typeof categoryId !== "string" || !mongoose.isValidObjectId(categoryId)) {
                return res.status(400).json({ message: "Invalid categoryId" })
            }

            const children = await CategoryModel.find({ parentId: categoryId, isActive: true }).select("_id")
            filter.categoryId = { $in: [categoryId, ...children.map((c) => c._id)] }
        }

        const allowedSorts = ["newest", "oldest", "mostDownloaded", "relevance"]
        const sortKey = sort === undefined ? (keyword ? "relevance" : "newest") : sort
        if (typeof sortKey !== "string" || !allowedSorts.includes(sortKey)) {
            return res.status(400).json({ message: "Invalid sort option" })
        }

        let sortBy: Record<string, any>
        if (sortKey === "relevance" && keyword) {
            sortBy = { score: { $meta: "textScore" } }
        } else if (sortKey === "oldest") {
            sortBy = { createdAt: 1 }
        } else if (sortKey === "mostDownloaded") {
            sortBy = { downloadCount: -1, createdAt: -1 }
        } else {
            sortBy = { createdAt: -1 }
        }

        const [items, total] = await Promise.all([
            NoteModel.find(filter)
                .select("-rejectionReason -file.storageKey")
                .sort(sortBy)
                .skip(skip)
                .limit(limit)
                .populate("categoryId", "name")
                .populate("uploaderId", "name"),
            NoteModel.countDocuments(filter)
        ])

        res.status(200).json({
            message: "OK",
            data: { items, page, limit, total, totalPages: Math.ceil(total / limit) }
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load notes" })
    }
}

export const getNoteById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid note id" })
        }

        const note = await NoteModel.findOne({ _id: id, status: NoteStatus.APPROVED })
            .select("-rejectionReason -file.storageKey")
            .populate("categoryId", "name")
            .populate("uploaderId", "name")

        if (!note) {
            return res.status(404).json({ message: "Note not found" })
        }

        res.status(200).json({ message: "OK", data: note })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load note" })
    }
}

export const downloadNote = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.sub
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const { id } = req.params
        if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid note id" })
        }

        const note = await NoteModel.findById(id)
        if (!note || !note.file) {
            return res.status(404).json({ message: "Note not found" })
        }

        const isAdmin = req.user?.roles?.includes(UserRole.ADMIN) ?? false
        const isOwner = note.uploaderId.toString() === userId
        const isApproved = note.status === NoteStatus.APPROVED

        if (!isApproved && !isOwner && !isAdmin) {
            return res.status(404).json({ message: "Note not found" })
        }

        const url = await createDownloadUrl(note.file.storageKey, note.file.originalName)

        if (isApproved && req.query.preview !== "true") {
            await NoteModel.updateOne({ _id: note._id }, { $inc: { downloadCount: 1 } })
        }

        res.status(200).json({ message: "OK", data: { url, expiresInSeconds: 60 } })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to prepare download" })
    }
}