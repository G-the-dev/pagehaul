/**
 * The two emails the checkout sends, written once and used by the routes.
 *
 * Email HTML is its own dialect: inline styles, table-safe layout, no
 * external assets, system fonts. The wordmark is text because a remote
 * image in a first-contact email is exactly what spam filters resent.
 * Every message carries a plain-text twin for clients that prefer it.
 */

const WRAP = (inner: string) => `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:14px;border:1px solid #e5e5e5;">
<tr><td style="padding:28px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="font-size:17px;font-weight:700;letter-spacing:-0.01em;color:#111111;">pagehaul</div>
</td></tr>
${inner}
<tr><td style="padding:0 32px 26px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#a1a1a1;">Something wrong? Just reply to this email.<br>Found this in spam? Move it to your inbox so the next one lands right.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

const row = (label: string, value: string) => `
<tr>
<td style="padding:7px 0;font-size:13px;color:#737373;">${label}</td>
<td align="right" style="padding:7px 0;font-size:13px;font-weight:600;color:#111111;font-family:ui-monospace,Menlo,Consolas,monospace;">${value}</td>
</tr>`;

export function buyerUnlockEmail(args: {
  plan: "pro" | "pack";
  amount: number;
  reference: string;
  restoreUrl: string;
  packScans: number;
}): { subject: string; html: string; text: string } {
  const planLabel =
    args.plan === "pro" ? "Pro · one month" : `${args.packScans} deep scans`;
  const subject =
    args.plan === "pro"
      ? "You're unlocked · pagehaul Pro"
      : `You're unlocked · ${args.packScans} deep scans`;

  const html = WRAP(`
<tr><td style="padding:22px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<h1 style="margin:0;font-size:21px;line-height:1.3;letter-spacing:-0.01em;color:#111111;"><span style="color:#10b981;">&#10003;</span> You&#39;re unlocked</h1>
<p style="margin:12px 0 0;font-size:14px;line-height:1.65;color:#525252;">Open this on any other device you want unlocked:</p>
</td></tr>
<tr><td style="padding:20px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;" align="center">
<a href="${args.restoreUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:999px;">Unlock this device</a>
</td></tr>
<tr><td style="padding:8px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;" align="center">
<p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:#a1a1a1;">Keep this email. The link is the key.</p>
</td></tr>
<tr><td style="padding:20px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ececec;">
${row("Plan", planLabel)}
${row("Amount", "₹" + args.amount)}
${row("Reference", args.reference)}
</table>
</td></tr>`);

  const text = [
    "Payment received. You're unlocked.",
    "",
    "The browser you paid in is already unlocked. To use your plan on",
    "any other device or browser, open this link there:",
    "",
    args.restoreUrl,
    "",
    "Keep this email. If pagehaul ever locks again, this link is the key.",
    "",
    `Plan: ${planLabel}`,
    `Amount: ₹${args.amount}`,
    `Reference: ${args.reference}`,
    "",
    "Something wrong? Just reply to this email.",
  ].join("\n");

  return { subject, html, text };
}

export function ownerClaimEmail(args: {
  plan: "pro" | "pack";
  amount: number;
  reference: string;
  buyerEmail: string;
  approveUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `UPI payment: ₹${args.amount} ${args.plan} · ${args.reference}`;

  const html = WRAP(`
<tr><td style="padding:22px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<h1 style="margin:0;font-size:19px;line-height:1.3;color:#111111;">Payment window opened</h1>
<p style="margin:10px 0 0;font-size:14px;line-height:1.65;color:#525252;">When &#8377;${args.amount} lands with this reference in the note, approve. No payment? Ignore this.</p>
</td></tr>
<tr><td style="padding:16px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ececec;">
${row("Plan", `${args.plan} · ₹${args.amount}`)}
${row("Reference", args.reference)}
${row("Buyer", args.buyerEmail)}
</table>
</td></tr>
<tr><td style="padding:18px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;" align="center">
<a href="${args.approveUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:999px;">Approve · money is in</a>
</td></tr>`);

  const text = [
    `Plan: ${args.plan} (₹${args.amount})`,
    `Reference in the payment note: ${args.reference}`,
    `Buyer email: ${args.buyerEmail}`,
    "",
    "This fires when the payment window opens; the buyer has four",
    "minutes to pay. When the amount shows up with this reference,",
    "approve:",
    args.approveUrl,
    "",
    "No matching payment means they closed the window; ignore this mail.",
  ].join("\n");

  return { subject, html, text };
}

export function renewalReminderEmail(args: {
  amount: number;
  restoreUrl: string;
  endsOn: string;
}): { subject: string; html: string; text: string } {
  const subject = "Your pagehaul Pro ends in a week";
  const html = WRAP(`
<tr><td style="padding:22px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<h1 style="margin:0;font-size:21px;line-height:1.3;color:#111111;">Pro ends on ${args.endsOn}</h1>
<p style="margin:12px 0 0;font-size:14px;line-height:1.65;color:#525252;">One tap keeps unlimited deep scans and everything unlocked.</p>
</td></tr>
<tr><td style="padding:20px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;" align="center">
<a href="${args.restoreUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:999px;">Renew Pro · ₹${args.amount}</a>
</td></tr>`);
  const text = [
    `Your pagehaul Pro ends on ${args.endsOn}.`,
    "",
    "Renewing takes a minute. Open this link, it unlocks the browser it",
    "opens in, and pick Pro again from the pricing section:",
    "",
    args.restoreUrl,
  ].join("\n");
  return { subject, html, text };
}

export function lowPackEmail(args: {
  packScans: number;
  amount: number;
  restoreUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "One deep scan left in your pack";
  const html = WRAP(`
<tr><td style="padding:22px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<h1 style="margin:0;font-size:21px;line-height:1.3;color:#111111;">One scan left</h1>
<p style="margin:12px 0 0;font-size:14px;line-height:1.65;color:#525252;">A refill adds ${args.packScans} more, and what&#39;s left carries over.</p>
</td></tr>
<tr><td style="padding:20px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;" align="center">
<a href="${args.restoreUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:999px;">Refill · ₹${args.amount}</a>
</td></tr>`);
  const text = [
    "Your pack is down to its last deep scan.",
    "",
    `A refill is ${args.packScans} more for ₹${args.amount}. Open this link, it`,
    "unlocks the browser it opens in, then use the pricing section:",
    "",
    args.restoreUrl,
  ].join("\n");
  return { subject, html, text };
}

export function resendUnlockEmail(args: {
  planLabel: string;
  restoreUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "Your pagehaul unlock link";
  const html = WRAP(`
<tr><td style="padding:22px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<h1 style="margin:0;font-size:21px;line-height:1.3;color:#111111;">You already have ${args.planLabel}</h1>
<p style="margin:12px 0 0;font-size:14px;line-height:1.65;color:#525252;">Open this on any device to use it there:</p>
</td></tr>
<tr><td style="padding:20px 32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;" align="center">
<a href="${args.restoreUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:999px;">Unlock this device</a>
</td></tr>`);
  const text = [
    `You already have ${args.planLabel}.`,
    "",
    "Open this on any device to use it there:",
    "",
    args.restoreUrl,
  ].join("\n");
  return { subject, html, text };
}
