import nodemailer from "nodemailer";

/**
 * All product email goes out through the owner's own Gmail over SMTP.
 *
 * Chosen over an email API on plain economics and reach: Gmail sends 500
 * mails a day for nothing, delivers to anyone, and arrives with Google's
 * own SPF and DKIM, which is a better spam-folder record than any starter
 * tier of any email service. Configuration is two variables: GMAIL_USER
 * (the address) and GMAIL_APP_PASSWORD (an app password, not the real
 * one). Missing config fails soft: callers treat it as mail-not-set-up.
 */

let cached: nodemailer.Transporter | null = null;

export function mailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function transporter(): nodemailer.Transporter {
  if (!cached) {
    cached = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return cached;
}

export async function sendMail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    await transporter().sendMail({
      from: `pagehaul <${process.env.GMAIL_USER}>`,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    return true;
  } catch (e) {
    console.error("mail send failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
