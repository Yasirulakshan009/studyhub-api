import { Server } from "socket.io"
import type { Server as HttpServer } from "node:http"
import mongoose from "mongoose"
import { verifyAccessToken } from "./util/jwt"
import { ConversationModel } from "./models/conversation.model"

export const initializeSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: true,
            methods: ["GET", "POST"]
        }
    })

    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token

            if (!token || typeof token !== "string") {
                return next(new Error("Authentication required"))
            }

            const payload = verifyAccessToken(token)

            if (!payload.sub) {
                return next(new Error("Invalid token"))
            }

            socket.data.userId = payload.sub
            next()
        } catch {
            next(new Error("Invalid or expired token"))
        }
    })

    io.on("connection", (socket) => {
        console.log("User connected:", socket.data.userId)

        socket.join(`user:${socket.data.userId}`)

        socket.on("conversation:join", async (conversationId: string, callback) => {
            try {
                if (!mongoose.isValidObjectId(conversationId)) {
                    return callback?.({ success: false, message: "Invalid conversation ID" })
                }

                const conversation = await ConversationModel.exists({
                    _id: conversationId,
                    participants: socket.data.userId
                })

                if (!conversation) {
                    return callback?.({ success: false, message: "Access denied" })
                }

                await socket.join(`conversation:${conversationId}`)

                callback?.({ success: true })
            } catch (error) {
                console.error("Conversation join error:", error)
                callback?.({ success: false, message: "Failed to join conversation" })
            }
        })

        socket.on("conversation:leave", (conversationId: string) => {
            if (typeof conversationId === "string") {
                socket.leave(`conversation:${conversationId}`)
            }
        })

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.data.userId)
        })
    })

    return io
}

export let io: Server
