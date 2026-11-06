import { Document, model, Schema, Types } from "mongoose"

export enum NoteStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}

export interface INoteFile {
    storageKey: string
    fileUrl?: string
    originalName: string
    mimeType: string
    sizeBytes: number
}

export interface INote extends Document {
    title: string
    description: string
    subject?: string
    tags: string[]
    categoryId: Types.ObjectId
    uploaderId: Types.ObjectId
    file?: INoteFile
    status: NoteStatus
    rejectionReason?: string
    downloadCount: number
    aiSummary?: string
    createdAt: Date
    updatedAt: Date
}

const fileSchema = new Schema<INoteFile>(
    {
        storageKey: { type: String, required: true },
        fileUrl: { type: String },
        originalName: { type: String, required: true, maxlength: 255 },
        mimeType: { type: String, required: true },
        sizeBytes: { type: Number, required: true, min: 1 }
    },
    { _id: false }
)

const noteSchema = new Schema<INote>(
    {
        title: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
        description: { type: String, required: true, trim: true, maxlength: 2000 },
        subject: { type: String, trim: true, maxlength: 100 },
        tags: {
            type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
            default: [],
            validate: {
                validator: (value: string[]) => value.length <= 10,
                message: "A note can have at most 10 tags"
            }
        },
        categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
        uploaderId: { type: Schema.Types.ObjectId, ref: "users", required: true },
        file: { type: fileSchema },
        status: { type: String, enum: Object.values(NoteStatus), default: NoteStatus.PENDING },
        rejectionReason: { type: String, trim: true, maxlength: 300 },
        downloadCount: { type: Number, default: 0, min: 0 },
        aiSummary: { type: String }
    },
    { timestamps: true }
)

noteSchema.index(
    { title: "text", description: "text", tags: "text" },
    { weights: { title: 5, tags: 3, description: 1 }, name: "note_text_search" }
)

noteSchema.index({ status: 1, createdAt: -1 })
noteSchema.index({ categoryId: 1, status: 1 })
noteSchema.index({ uploaderId: 1, createdAt: -1 })

export const NoteModel = model<INote>("Note", noteSchema)