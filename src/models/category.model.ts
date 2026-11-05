import mongoose, { Document, model, Schema, Types } from "mongoose"

export interface ICategory extends Document {
    name: string
    description?: string
    parentId: Types.ObjectId | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

const categorySchema = new Schema<ICategory>(
    {
        name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 50 },
        description: { type: String, trim: true, maxlength: 300 },
        parentId: { type: Schema.Types.ObjectId, ref: "categories", default: null },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
)

categorySchema.index({ name: 1, parentId: 1 }, { unique: true })

export const CategoryModel = mongoose.model<ICategory>("Category", categorySchema)