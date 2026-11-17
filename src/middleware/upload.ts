import multer from "multer"
import { NextFunction, Request, Response } from "express"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("ONLY_PDF"))
        }
        cb(null, true)
    }
})

export const uploadPdf = (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err: any) => {
        if (!err) {
            return next()
        }

        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({ message: "File is too large. Maximum size is 10 MB" })
            }
            return res.status(400).json({ message: "Invalid file upload" })
        }

        if (err.message === "ONLY_PDF") {
            return res.status(400).json({ message: "Only PDF files are allowed" })
        }

        console.error(err)
        res.status(500).json({ message: "File upload failed" })
    })
}

const MAX_AVATAR_SIZE = 2 * 1024 * 1024
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]

const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AVATAR_SIZE, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (!AVATAR_TYPES.includes(file.mimetype)) {
            return cb(new Error("ONLY_IMAGE"))
        }
        cb(null, true)
    }
})

export const uploadAvatar = (req: Request, res: Response, next: NextFunction) => {
    avatarUpload.single("avatar")(req, res, (err: any) => {
        if (!err) {
            return next()
        }

        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({ message: "Image is too large. Maximum size is 2 MB" })
            }
            return res.status(400).json({ message: "Invalid image upload" })
        }

        if (err.message === "ONLY_IMAGE") {
            return res.status(400).json({ message: "Only JPG, PNG or WebP images are allowed" })
        }

        console.error(err)
        res.status(500).json({ message: "Image upload failed" })
    })
}