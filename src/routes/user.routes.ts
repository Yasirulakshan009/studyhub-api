import { Router } from "express"
import { getPublicUserProfile } from "../controllers/user.controller"
import { optionalAuthenticate } from "../middleware/auth"

const router = Router()

router.get("/:id/profile", optionalAuthenticate, getPublicUserProfile)

export default router