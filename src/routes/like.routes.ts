
import { Router } from "express"
import { toggleLike, getLikeStatus } from "../controllers/like.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

router.post("/:noteId/toggle", authenticate, toggleLike)
router.get("/:noteId", authenticate, getLikeStatus)

export default router
