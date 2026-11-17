
import { Router } from "express"
import { getPublicUserProfile } from "../controllers/user.controller"

const router = Router()

router.get("/:id/profile", getPublicUserProfile)

export default router
