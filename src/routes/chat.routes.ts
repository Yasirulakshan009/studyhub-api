import { Router } from "express"
import {
    createConversation,
    getConversations,
    getMessages,
    sendMessage,
    markMessagesAsRead
} from "../controllers/chat.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

router.post("/conversations", authenticate, createConversation)
router.get("/conversations", authenticate, getConversations)
router.get("/conversations/:conversationId/messages", authenticate, getMessages)
router.post("/conversations/:conversationId/messages", authenticate, sendMessage)
router.patch("/conversations/:conversationId/read", authenticate, markMessagesAsRead)

export default router