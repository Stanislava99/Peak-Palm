import nodemailer, { type Transporter } from "nodemailer";
import { contactEmail, isTestSite } from "./site-config";

/**
 * Sends email through Resend (RESEND_API_KEY) or any SMTP mailbox (SMTP_HOST/PORT/USER/PASS),
 * e.g. Gmail or Yahoo with an app password. Always over TLS.
 * EMAIL_FROM sets the sender, e.g. "Sea & Ski Villas <bookings@seaandskivillas.com>".
 */
export type Attachment = { filename: string; content: Buffer; contentType?: string };
export type Email = {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
};

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() || (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim()));
}

function sender() {
  const explicit = process.env.EMAIL_FROM?.trim();
  if (explicit) return explicit;
  const user = process.env.SMTP_USER?.trim();
  return user ? `Sea & Ski Villas <${user}>` : "Sea & Ski Villas <onboarding@resend.dev>";
}

const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

let transport: Transporter | null = null;
function smtp() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT) || 465;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim(),
    port,
    secure: port === 465,
    requireTLS: true,
    // App passwords are shown with spaces (e.g. "abcd efgh ijkl mnop"); pasted values can carry stray whitespace.
    auth: { user: process.env.SMTP_USER?.trim(), pass: process.env.SMTP_PASS?.replace(/\s+/g, "") },
    tls: { minVersion: "TLSv1.2" },
  });
  return transport;
}

export async function sendEmail(email: Email): Promise<{ sent: boolean; error?: string }> {
  const to = [...new Set(email.to.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (!to.length) return { sent: false, error: "no recipients" };
  const subject = oneLine(`${isTestSite() ? "[TEST] " : ""}${email.subject}`);
  const replyTo = oneLine(email.replyTo ?? contactEmail());

  if (!emailConfigured()) {
    console.warn("Email not configured; would have sent:", { to, subject });
    return { sent: false, error: "email not configured" };
  }

  try {
    if (process.env.RESEND_API_KEY?.trim()) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sender(),
          to,
          subject,
          html: email.html,
          text: email.text,
          reply_to: replyTo,
          attachments: email.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error("Resend refused the email", response.status, detail.slice(0, 300));
        return { sent: false, error: `resend ${response.status}` };
      }
      return { sent: true };
    }

    await smtp().sendMail({
      from: sender(),
      to,
      subject,
      html: email.html,
      text: email.text,
      replyTo,
      attachments: email.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? "application/pdf",
      })),
    });
    return { sent: true };
  } catch (error) {
    console.error("Email failed", (error as Error).message);
    return { sent: false, error: (error as Error).message };
  }
}
