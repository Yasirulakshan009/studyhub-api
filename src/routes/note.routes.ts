import { Router } from "express"
import { createNote, getMyNotes } from "../controllers/note.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

router.post("/", authenticate, createNote)
router.get("/mine", authenticate, getMyNotes)

export default router