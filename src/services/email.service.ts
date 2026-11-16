const BREVO_URL = "https://api.brevo.com/v3/smtp/email"

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")

interface Recipient {
    email: string
    name: string
}

const sendEmail = async (to: Recipient, subject: string, html: string, text: string): Promise<void> => {
    const apiKey = process.env.BREVO_API_KEY
    const fromEmail = process.env.MAIL_FROM_EMAIL
    const fromName = process.env.MAIL_FROM_NAME || "StudyHub"

    if (!apiKey || !fromEmail) {
        throw new Error("MAIL_NOT_CONFIGURED")
    }

    const response = await fetch(BREVO_URL, {
        method: "POST",
        headers: {
            "api-key": apiKey,
            "content-type": "application/json",
            accept: "application/json"
        },
        body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: to.email, name: to.name }],
            subject,
            htmlContent: html,
            textContent: text
        }),
        signal: AbortSignal.timeout(10_000)
    })

    if (!response.ok) {
        const details = await response.text().catch(() => "")
        console.error(`Brevo request failed (${response.status}):`, details)
        throw new Error("MAIL_FAILED")
    }
}

export const sendPasswordResetEmail = async (to: Recipient, resetUrl: string): Promise<void> => {
    const name = escapeHtml(to.name)
    const link = escapeHtml(resetUrl)

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f7fc;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;color:#0a0a0a;">
    <h1 style="margin:0 0 8px;font-size:22px;">Reset your StudyHub password</h1>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.5;">
      Hi ${name}, we received a request to reset your password. This link works for 30 minutes.
    </p>
    <a href="${link}" style="display:inline-block;background:#0a84ff;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:999px;">
      Choose a new password
    </a>
    <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.5;">
      If the button does not work, copy this link into your browser:<br />
      <span style="word-break:break-all;">${link}</span>
    </p>
    <p style="margin:20px 0 0;color:#64748b;font-size:13px;">
      If you did not ask for this, you can safely ignore this email. Your password will not change.
    </p>
  </div>
</div>`

    const text = [
        `Hi ${to.name},`,
        "",
        "We received a request to reset your StudyHub password. This link works for 30 minutes:",
        resetUrl,
        "",
        "If you did not ask for this, you can safely ignore this email. Your password will not change."
    ].join("\n")

    await sendEmail(to, "Reset your StudyHub password", html, text)
}