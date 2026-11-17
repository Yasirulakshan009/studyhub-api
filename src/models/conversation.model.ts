
import { Document, model, Schema, Types } from "mongoose"

export interface IConversation extends Document {
    participants: Types.ObjectId[]
    participantKey: string
    lastMessage?: string
    lastMessageAt?: Date
}

const conversationSchema = new Schema<IConversation>(
    {
        participants: {
            type: [{
                type: Schema.Types.ObjectId,
                ref: "users"
            }],
            required: true,
            validate: {
                validator: (value: Types.ObjectId[]) =>
                    value.length === 2 &&
                    !value[0].equals(value[1]),
                message: "A conversation must have exactly two different participants"
            }
        },
        participantKey: {
            type: String,
            required: true,
            unique: true
        },
        lastMessage: {
            type: String,
            default: ""
        },
        lastMessageAt: {
            type: Date
        }
    },
    { timestamps: true }
)

conversationSchema.index({ participants: 1 })

export const ConversationModel = model<IConversation>(
    "conversations",
    conversationSchema
)
