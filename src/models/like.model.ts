
import { Document, model, Schema, Types } from "mongoose"

export interface ILike extends Document {
    userId: Types.ObjectId
    noteId: Types.ObjectId
}

const likeSchema = new Schema<ILike>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true
        },
        noteId: {
            type: Schema.Types.ObjectId,
            ref: "Note",
            required: true
        }
    },
    {
        timestamps: true
    }
)

likeSchema.index(
    { userId: 1, noteId: 1 },
    { unique: true }
)

likeSchema.index({ noteId: 1 })

likeSchema.index({ userId: 1 })

export const LikeModel = model<ILike>("Like", likeSchema)
