// Gmail SMTP sender — uses hr@relife.co.th via Google Workspace App Password
// Configure: GMAIL_USER + GMAIL_APP_PASSWORD in .env

import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions) {
  const transporter = getTransporter();
  const from = `"Relife Solutions HR" <${process.env.GMAIL_USER}>`;

  const info = await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo ?? process.env.GMAIL_USER,
  });

  return info;
}

/** Replace template variables: {ชื่อ} {ตำแหน่ง} */
export function renderEmailTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
