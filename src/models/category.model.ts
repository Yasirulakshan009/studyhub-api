import mongoose, { Document, Schema } from "mongoose"

export interface ICategory extends Document {
    name: string
    slug: string
    description?: string
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

const categorySchema = new Schema<ICategory>(
    {
        name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 50 },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        description: { type: String, trim: true, maxlength: 300 },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
)

export const CategoryModel = mongoose.model<ICategory>("Category", categorySchema)