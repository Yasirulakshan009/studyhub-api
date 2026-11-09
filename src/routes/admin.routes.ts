import { Router, Response } from "express"
import { authenticate, AuthRequest } from "../middleware/auth"
import { requireRole } from "../middleware/role"
import { UserRole } from "../models/user.model"
import { getPendingNotes, reviewNote } from "../controllers/note.controller" 

const router = Router()

router.get("/ping", authenticate, requireRole([UserRole.ADMIN]), (req: AuthRequest, res: Response) => {
    res.status(200).json({ message: "Welcome admin", userId: req.user?.sub })
})

router.get("/notes/pending", authenticate, requireRole([UserRole.ADMIN]), getPendingNotes)
router.put("/notes/:id/review", authenticate, requireRole([UserRole.ADMIN]), reviewNote)

export default router