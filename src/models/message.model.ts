
import { Document, model, Schema, Types } from "mongoose"

export interface IMessage extends Document {
    conversationId: Types.ObjectId
    senderId: Types.ObjectId
    receiverId: Types.ObjectId
    text: string
    readAt?: Date | null
    createdAt?: Date
    updatedAt?: Date
}

const messageSchema = new Schema<IMessage>(
    {
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: "conversations",
            required: true
        },
        senderId: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true
        },
        receiverId: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true
        },
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },
        readAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
)

messageSchema.index({ conversationId: 1, createdAt: -1 })
messageSchema.index({ conversationId: 1, receiverId: 1, readAt: 1 })

export const MessageModel = model<IMessage>(
    "messages",
    messageSchema
)
