import nodemailer from "nodemailer";

export async function sendAccountEmail(to: string, subject: string, url: string) {
  const host = process.env.SMTP_HOST;
  const from = process.env.EMAIL_FROM;
  if (!host || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    console.info(`[Kintovo local email] ${subject}: ${url}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transporter.sendMail({
    from,
    to,
    subject,
    text: `${subject}\n\nUse this one-time Kintovo link: ${url}\n\nIf you did not request this, ignore this email.`,
  });
}
