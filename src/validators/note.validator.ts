import mongoose from "mongoose"

export interface NoteFields {
    title?: string
    description?: string
    subject?: string
    tags?: string[]
    categoryId?: string
}

interface ParseResult {
    data?: NoteFields
    error?: string
}

export const parseNoteFields = (body: any, mode: "create" | "update"): ParseResult => {
    const { title, description, subject, tags, categoryId } = body ?? {}
    const isCreate = mode === "create"
    const data: NoteFields = {}

    if (isCreate || title !== undefined) {
        if (typeof title !== "string" || title.trim().length < 5 || title.trim().length > 120) {
            return { error: "Title must be 5 to 120 characters" }
        }
        data.title = title.trim()
    }

    if (isCreate || description !== undefined) {
        if (typeof description !== "string" || !description.trim() || description.trim().length > 2000) {
            return { error: "Description is required (max 2000 characters)" }
        }
        data.description = description.trim()
    }

    if (subject !== undefined) {
        if (typeof subject !== "string" || subject.trim().length > 100) {
            return { error: "Subject must be text up to 100 characters" }
        }
        data.subject = subject.trim()
    }

    if (tags !== undefined) {
        if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
            return { error: "Tags must be an array of text" }
        }

        const cleanTags = [...new Set(tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean))]

        if (cleanTags.length > 10 || cleanTags.some((t) => t.length > 30)) {
            return { error: "Up to 10 tags, each up to 30 characters" }
        }
        data.tags = cleanTags
    }

    if (isCreate || categoryId !== undefined) {
        if (typeof categoryId !== "string" || !mongoose.isValidObjectId(categoryId)) {
            return { error: "A valid categoryId is required" }
        }
        data.categoryId = categoryId
    }

    return { data }
}