import { Router, Response } from "express"
import { authenticate, AuthRequest } from "../middleware/auth"
import { requireRole } from "../middleware/role"
import { UserRole } from "../models/user.model"

const router = Router()

router.get("/ping", authenticate, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
    res.status(200).json({ message: "Welcome admin", userId: req.user?.sub })
})

export default router