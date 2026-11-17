import { Response } from "express"
import mongoose from "mongoose"
import { AuthRequest } from "../middleware/auth"
import { UserModel } from "../models/user.model"
import { ConversationModel } from "../models/conversation.model"
import { MessageModel } from "../models/message.model"
import { io } from "../socket"

const getUserId = (req: AuthRequest) => req.user?.sub

export const createConversation = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = getUserId(req)
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const { otherUserId } = req.body

        if (
            typeof otherUserId !== "string" ||
            !mongoose.isValidObjectId(otherUserId)
        ) {
            return res.status(400).json({ message: "Invalid user id" })
        }

        const normalizedUserId = new mongoose.Types.ObjectId(userId).toString()
        const normalizedOtherUserId = new mongoose.Types.ObjectId(otherUserId).toString()

        if (normalizedUserId === normalizedOtherUserId) {
            return res.status(400).json({
                message: "You cannot start a conversation with yourself"
            })
}

        const otherUser = await UserModel.findById(otherUserId).select("_id")

        if (!otherUser) {
            return res.status(404).json({ message: "User not found" })
        }

        const participants = [normalizedUserId, normalizedOtherUserId].sort()
        const participantKey = participants.join("_")

        try {
            const conversation = await ConversationModel.findOneAndUpdate(
                { participantKey },
                {
                    $setOnInsert: {
                        participants,
                        participantKey
                    }
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true
                }
            )

            return res.status(200).json({
                message: "Conversation ready",
                data: conversation
            })
        } catch (error: any) {
            if (error?.code === 11000) {
                const existing = await ConversationModel.findOne({
                    participantKey
                })

                if (existing) {
                    return res.status(200).json({
                        message: "Conversation ready",
                        data: existing
                    })
                }
            }

            throw error
        }
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            message: "Failed to create conversation"
        })
    }
}

export const getConversations = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = getUserId(req)
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const conversations = await ConversationModel.find({
            participants: userId
        })
            .populate("participants", "name avatarUrl")
            .sort({ lastMessageAt: -1, updatedAt: -1 })

        const unreadCounts = await MessageModel.aggregate([
            {
                $match: {
                    receiverId: new mongoose.Types.ObjectId(userId),
                    readAt: null
                }
            },
            {
                $group: {
                    _id: "$conversationId",
                    count: { $sum: 1 }
                }
            }
        ])

        const unreadMap = new Map(
            unreadCounts.map((item) => [
                item._id.toString(),
                item.count
            ])
        )

        return res.status(200).json({
            message: "OK",
            data: conversations.map((conversation) => ({
                ...conversation.toObject(),
                unreadCount:
                    unreadMap.get(conversation._id.toString()) ?? 0
            }))
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            message: "Failed to load conversations"
        })
    }
}

export const getMessages = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = getUserId(req)
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const { conversationId } = req.params

        if (
            typeof conversationId !== "string" ||
            !mongoose.isValidObjectId(conversationId)
        ) {
            return res.status(400).json({
                message: "Invalid conversation id"
            })
        }

        const conversation = await ConversationModel.findOne({
            _id: conversationId,
            participants: userId
        })

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found"
            })
        }

        const limit = Math.min(
            Math.max(parseInt(String(req.query.limit ?? "30"), 10) || 30, 1),
            50
        )

        const filter: Record<string, any> = {
            conversationId,
            $or: [
                { senderId: userId },
                { receiverId: userId }
            ]
        }

        if (typeof req.query.before === "string") {
            const beforeDate = new Date(req.query.before)

            if (Number.isNaN(beforeDate.getTime())) {
                return res.status(400).json({
                    message: "Invalid before date"
                })
            }

            filter.createdAt = { $lt: beforeDate }
        }

        const messages = await MessageModel.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit + 1)

        const hasMore = messages.length > limit
        const pageMessages = messages.slice(0, limit).reverse()

        return res.status(200).json({
            message: "OK",
            data: {
                items: pageMessages,
                hasMore,
                nextBefore: pageMessages.length
                    ? pageMessages[0].createdAt
                    : null
            }
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            message: "Failed to load messages"
        })
    }
}

export const sendMessage = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = getUserId(req)
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const { conversationId } = req.params

        if (
            typeof conversationId !== "string" ||
            !mongoose.isValidObjectId(conversationId)
        ) {
            return res.status(400).json({
                message: "Invalid conversation id"
            })
        }

        const text = typeof req.body.text === "string"
            ? req.body.text.trim()
            : ""

        if (!text || text.length > 2000) {
            return res.status(400).json({
                message: "Message must contain 1 to 2000 characters"
            })
        }

        const conversation = await ConversationModel.findOne({
            _id: conversationId,
            participants: userId
        })

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found"
            })
        }

        const receiverId = conversation.participants.find(
            (participant) => participant.toString() !== userId
        )

        if (!receiverId) {
            return res.status(400).json({
                message: "Invalid conversation participants"
            })
        }

        const message = await MessageModel.create({
            conversationId,
            senderId: userId,
            receiverId,
            text
        })

        conversation.lastMessage = text
        conversation.lastMessageAt = message.createdAt
        await conversation.save()

        io.to(`conversation:${conversationId}`).emit("message:new", message)

        io.to(`user:${receiverId.toString()}`).emit("notification:new", {
            conversationId,
            message
        })

        return res.status(201).json({
            message: "Message sent successfully",
            data: message
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            message: "Failed to send message"
        })
    }
}

export const markMessagesAsRead = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = getUserId(req)
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const { conversationId } = req.params

        if (
            typeof conversationId !== "string" ||
            !mongoose.isValidObjectId(conversationId)
        ) {
            return res.status(400).json({
                message: "Invalid conversation id"
            })
        }

        const conversation = await ConversationModel.findOne({
            _id: conversationId,
            participants: userId
        })

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found"
            })
        }

        const readAt = new Date()

        const result = await MessageModel.updateMany(
            {
                conversationId,
                receiverId: userId,
                readAt: null
            },
            {
                $set: { readAt }
            }
        )

        if (result.modifiedCount > 0) {
            io.to(`conversation:${conversationId}`).emit("messages:read", {
                conversationId,
                readerId: userId,
                readAt,
                updatedCount: result.modifiedCount
            })
        }

        return res.status(200).json({
            message: "Messages marked as read",
            data: {
                updatedCount: result.modifiedCount
            }
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            message: "Failed to mark messages as read"
        })
    }
}
