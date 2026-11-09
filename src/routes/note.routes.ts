import { Router } from "express"
import { createNote, getMyNotes, updateNote, deleteNote, listNotes, getNoteById } from "../controllers/note.controller"
import { authenticate } from "../middleware/auth"

const router = Router()

router.post("/", authenticate, createNote)
router.get("/", listNotes)
router.get("/mine", authenticate, getMyNotes)
router.get("/:id", getNoteById)
router.put("/:id", authenticate, updateNote)
router.delete("/:id", authenticate, deleteNote)

export default router