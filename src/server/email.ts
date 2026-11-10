import nodemailer from "nodemailer";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

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
  const isPasswordReset = subject.toLowerCase().includes("reset");
  const heading = isPasswordReset ? "Reset your password" : subject.toLowerCase().includes("invitation") ? "You’re invited to Kintovo" : "Verify your email address";
  const action = isPasswordReset ? "Reset password" : subject.toLowerCase().includes("invitation") ? "View invitation" : "Verify email address";
  const description = isPasswordReset
    ? "Use the button below to choose a new password for your Kintovo account."
    : subject.toLowerCase().includes("invitation")
      ? "Use the button below to view your Kintovo invitation."
      : "Use the button below to verify your Kintovo account and continue.";
  await transporter.sendMail({
    from,
    to,
    subject,
    text: `${subject}\n\nUse this one-time Kintovo link: ${url}\n\nIf you did not request this, ignore this email.`,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f5f0;color:#202522;font-family:Arial,sans-serif">
    <div style="padding:40px 16px">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e0d7">
        <div style="padding:24px 28px;border-bottom:1px solid #e5e0d7">
          <div style="color:#e45a3d;font-size:16px;font-weight:700;letter-spacing:2px">KINTOVO</div>
        </div>
        <div style="padding:32px 28px">
          <p style="margin:0 0 16px;color:#68716c;font-size:12px;letter-spacing:1px;text-transform:uppercase">Account security</p>
          <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2">${heading}</h1>
          <p style="margin:0 0 28px;color:#68716c;font-size:15px;line-height:1.6">${description}</p>
          <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 20px;border-radius:5px;color:#ffffff;background:#e45a3d;font-size:14px;font-weight:700;text-decoration:none">${action}</a>
          <p style="margin:28px 0 0;color:#68716c;font-size:12px;line-height:1.6">This one-time link expires in 24 hours. If you did not create a Kintovo account, you can ignore this email.</p>
        </div>
        <div style="padding:18px 28px;border-top:1px solid #e5e0d7;color:#68716c;font-size:11px">Kintovo · Nigeria first · African talent · Global and regional businesses</div>
      </div>
    </div>
  </body>
</html>`,
  });
}
