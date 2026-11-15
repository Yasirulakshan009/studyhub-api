import { getGemini } from "../config/gemini"

const PROMPT = `You are helping university students study. Summarize the attached PDF for a student.

Rules:
- Write in the same language as the document.
- Start with an overview of 2 to 3 sentences.
- Then write "Key points:" followed by 5 to 8 short lines, each starting with "- ".
- Use plain text only. Do not use markdown symbols such as ** or #.
- Stay under 200 words and use only information found in the document.
- If the document has no readable text, reply exactly: "No readable text was found in this PDF."`

export interface Summary {
    text: string
    model: string
}

const statusOf = (error: unknown): number | undefined => {
    if (typeof error === "object" && error !== null && "status" in error) {
        const status = (error as { status?: unknown }).status
        return typeof status === "number" ? status : undefined
    }
    return undefined
}

const shouldFallback = (error: unknown): boolean => {
    const status = statusOf(error)
    return status === undefined || status === 404 || status === 429 || status >= 500
}

const generate = async (model: string, base64: string): Promise<string> => {
    const response = await getGemini().models.generateContent({
        model,
        contents: [
            { inlineData: { mimeType: "application/pdf", data: base64 } },
            { text: PROMPT }
        ],
        config: { temperature: 0.3 }
    })

    const text = response.text?.trim()
    if (!text) {
        throw new Error("AI_EMPTY")
    }

    return text
}

export const summarizePdf = async (pdf: Buffer): Promise<Summary> => {
    getGemini()

    const primary = process.env.GEMINI_MODEL || "gemini-2.5-flash"
    const fallback = process.env.GEMINI_FALLBACK_MODEL
    const models = [primary, ...(fallback && fallback !== primary ? [fallback] : [])]
    const base64 = pdf.toString("base64")

    let lastError: unknown

    for (const model of models) {
        try {
            return { text: await generate(model, base64), model }
        } catch (error) {
            lastError = error
            console.error(`Gemini request failed (${model}):`, statusOf(error) ?? error)

            if (!shouldFallback(error)) {
                break
            }
        }
    }

    throw new Error(statusOf(lastError) === 429 ? "AI_BUSY" : "AI_UNAVAILABLE")
}