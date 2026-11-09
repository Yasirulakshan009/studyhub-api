import { createClient, SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

export const getSupabase = (): SupabaseClient => {
    if (client) {
        return client
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    }

    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false }
    })

    return client
}

export const getBucketName = (): string => process.env.SUPABASE_BUCKET || "notes"