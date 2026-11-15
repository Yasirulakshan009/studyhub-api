import { GoogleGenAI } from "@google/genai"

let client: GoogleGenAI | null = null

export const getGemini = (): GoogleGenAI => {
    if (client) {
        return client
    }

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
        throw new Error("AI_NOT_CONFIGURED")
    }

    client = new GoogleGenAI({ apiKey })

    return client
}