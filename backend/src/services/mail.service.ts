import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Outgoing e-mail over SMTP. Works with Gmail / Google Workspace or any SMTP
 * provider, configured only through env:
 *
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465                 # 465 = TLS, 587 = STARTTLS
 *   SMTP_USER=you@gmail.com
 *   SMTP_PASS=abcd efgh ijkl mnop # Gmail App Password (spaces are fine)
 *   SMTP_FROM="Djaber.ai <you@gmail.com>"   # optional, defaults to SMTP_USER
 */

let transporter: Transporter | null = null;

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        // Google shows App Passwords as "abcd efgh ijkl mnop"; the spaces are not part of it.
        pass: String(process.env.SMTP_PASS || '').replace(/\s+/g, ''),
      },
    });
  }
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(mail: MailInput): Promise<void> {
  const from = process.env.SMTP_FROM || `Djaber.ai <${process.env.SMTP_USER}>`;
  await getTransporter().sendMail({ from, ...mail });
}

/** Opens a connection and authenticates, without sending anything. */
export async function verifyMailConnection(): Promise<void> {
  await getTransporter().verify();
}
