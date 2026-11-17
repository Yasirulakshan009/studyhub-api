import { Document, model, Schema } from "mongoose"

export enum UserRole {
    ADMIN = "ADMIN",
    STUDENT = "STUDENT"
}

export interface IUser extends Document {
    name: string
    email: string
    password: string
    roles: UserRole[]
    passwordResetTokenHash?: string
    passwordResetExpires?: Date
    avatarUrl?: string
    avatarKey?: string
}

const userSchema = new Schema<IUser>(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        roles: {
          type: [String],
          enum: Object.values(UserRole),
          default: [UserRole.STUDENT]
        },
        passwordResetTokenHash: { type: String, select: false },
        passwordResetExpires: { type: Date, select: false },
        avatarUrl: { type: String },
        avatarKey: { type: String, select: false }
    },
    { timestamps: true}    
)

userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true })
 
export const UserModel = model<IUser>("users", userSchema)