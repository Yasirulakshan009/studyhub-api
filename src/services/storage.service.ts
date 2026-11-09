import { randomUUID } from "node:crypto"
import { getSupabase, getBucketName } from "../config/supabase"

const PDF_SIGNATURE = "%PDF-"

export interface StoredFile {
    storageKey: string
    originalName: string
    mimeType: string
    sizeBytes: number
}

const isPdfBuffer = (buffer: Buffer): boolean => {
    return buffer.subarray(0, 5).toString("latin1") === PDF_SIGNATURE
}

export const saveNoteFile = async (file: Express.Multer.File, uploaderId: string): Promise<StoredFile> => {
    if (!isPdfBuffer(file.buffer)) {
        throw new Error("INVALID_PDF")
    }

    const storageKey = `${uploaderId}/${randomUUID()}.pdf`

    const { error } = await getSupabase()
        .storage
        .from(getBucketName())
        .upload(storageKey, file.buffer, { contentType: "application/pdf", upsert: false })

    if (error) {
        console.error(error)
        throw new Error("STORAGE_UPLOAD_FAILED")
    }

    return {
        storageKey,
        originalName: file.originalname.slice(0, 255),
        mimeType: "application/pdf",
        sizeBytes: file.size
    }
}

export const deleteNoteFile = async (storageKey: string): Promise<void> => {
    const { error } = await getSupabase()
        .storage
        .from(getBucketName())
        .remove([storageKey])

    if (error) {
        console.error(error)
        throw new Error("STORAGE_DELETE_FAILED")
    }
}

export const createDownloadUrl = async (storageKey: string, originalName: string): Promise<string> => {
    const { data, error } = await getSupabase()
        .storage
        .from(getBucketName())
        .createSignedUrl(storageKey, 60, { download: originalName })

    if (error || !data) {
        console.error(error)
        throw new Error("STORAGE_URL_FAILED")
    }

    return data.signedUrl
}