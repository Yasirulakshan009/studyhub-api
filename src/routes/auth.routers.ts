import { Router } from "express"
import { register, registerAdmin, login, refresh, me, updateMyProfile } from "../controllers/auth.controller"
import { authenticate } from "../middleware/auth"
import { requireRole } from "../middleware/role"
import { UserRole } from "../models/user.model"

const router = Router()

router.post("/register", register)
router.post("/register-admin", authenticate, requireRole([UserRole.ADMIN]), registerAdmin)
router.post("/login", login)
router.post("/refresh", refresh)
router.get("/me", authenticate, me)
router.put("/me", authenticate, updateMyProfile)

export default router