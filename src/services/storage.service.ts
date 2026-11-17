import { randomUUID } from "node:crypto"
import { getSupabase, getBucketName, getAvatarBucketName } from "../config/supabase"

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

export const downloadNoteFile = async (storageKey: string): Promise<Buffer> => {
    const { data, error } = await getSupabase()
        .storage
        .from(getBucketName())
        .download(storageKey)

    if (error || !data) {
        console.error(error)
        throw new Error("STORAGE_DOWNLOAD_FAILED")
    }

    return Buffer.from(await data.arrayBuffer())
}

interface DetectedImage {
    ext: string
    mime: string
}

const detectImage = (buffer: Buffer): DetectedImage | null => {
    if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { ext: "jpg", mime: "image/jpeg" }
    }

    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    if (buffer.length > 8 && buffer.subarray(0, 8).equals(pngSignature)) {
        return { ext: "png", mime: "image/png" }
    }

    if (
        buffer.length > 12 &&
        buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
        buffer.subarray(8, 12).toString("latin1") === "WEBP"
    ) {
        return { ext: "webp", mime: "image/webp" }
    }

    return null
}

export interface StoredAvatar {
    key: string
    url: string
}

export const saveAvatarFile = async (file: Express.Multer.File, userId: string): Promise<StoredAvatar> => {
    const type = detectImage(file.buffer)
    if (!type) {
        throw new Error("INVALID_IMAGE")
    }

    const key = `${userId}/${randomUUID()}.${type.ext}`
    const bucket = getSupabase().storage.from(getAvatarBucketName())

    const { error } = await bucket.upload(key, file.buffer, {
        contentType: type.mime,
        upsert: false,
        cacheControl: "31536000"
    })

    if (error) {
        console.error(error)
        throw new Error("STORAGE_UPLOAD_FAILED")
    }

    const { data } = bucket.getPublicUrl(key)
    return { key, url: data.publicUrl }
}

export const deleteAvatarFile = async (key: string): Promise<void> => {
    const { error } = await getSupabase().storage.from(getAvatarBucketName()).remove([key])

    if (error) {
        console.error(error)
        throw new Error("STORAGE_DELETE_FAILED")
    }
}