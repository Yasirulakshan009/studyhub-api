import { Router } from "express"
import { createNote, getMyNotes, updateNote, deleteNote, listNotes, getNoteById, downloadNote } from "../controllers/note.controller"
import { authenticate } from "../middleware/auth"
import { uploadPdf } from "../middleware/upload"

const router = Router()

router.post("/", authenticate, uploadPdf, createNote)
router.get("/", listNotes)
router.get("/mine", authenticate, getMyNotes)
router.get("/:id", getNoteById)
router.put("/:id", authenticate, updateNote)
router.delete("/:id", authenticate, deleteNote)
router.get("/:id/download", authenticate, downloadNote)

export default router