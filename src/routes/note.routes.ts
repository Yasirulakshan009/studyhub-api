
import { Router } from "express"
import {createNote,getMyNotes,updateNote,deleteNote,listNotes,getNoteById,downloadNote,summarizeNote} from "../controllers/note.controller"
import { authenticate, optionalAuthenticate } from "../middleware/auth"
import { uploadPdf } from "../middleware/upload"

const router = Router()

router.post("/", authenticate, uploadPdf, createNote)
router.get("/", optionalAuthenticate, listNotes)
router.get("/mine", authenticate, getMyNotes)
router.get("/:id", optionalAuthenticate, getNoteById)
router.put("/:id", authenticate, updateNote)
router.delete("/:id", authenticate, deleteNote)
router.get("/:id/download", authenticate, downloadNote)
router.post("/:id/summary", authenticate, summarizeNote)

export default router
