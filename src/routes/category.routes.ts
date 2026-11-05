import { Router } from "express"
import { createCategory, getCategories, getCategoryById } from "../controllers/category.controller"
import { authenticate } from "../middleware/auth"
import { requireRole } from "../middleware/role"
import { UserRole } from "../models/user.model"

const router = Router()

router.post("/", authenticate, requireRole([UserRole.ADMIN]), createCategory)
router.get("/", getCategories)
router.get("/:id", getCategoryById)

export default router