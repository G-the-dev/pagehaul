import { ImapFlow } from "imapflow";
import { verifyLicense, type LicensePayload } from "./license";

/**
 * The purchase ledger is the Gmail Sent folder.
 *
 * Every unlock email ever sent sits there, addressed to its buyer and
 * carrying the restore link, which carries the signed token, which carries
 * the plan and its expiry. Searching sent mail by recipient IS the lookup
 * "does this email already have a plan", with no database to run, back up,
 * or lose, and it survives every deploy because Google keeps it.
 *
 * IMAP costs a second or two, which the checkout's opening "checking"
 * moment absorbs. Missing credentials fail open: no ledger means no block,
 * never a broken checkout.
 */

const TOKEN_RE = /#restore=([A-Za-z0-9._%\-]+)/g;

export async function findActivePlan(
  email: string,
): Promise<{ payload: LicensePayload; token: string } | null> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("[Gmail]/Sent Mail");
    try {
      // Substring search per IMAP semantics: catches "You're unlocked" and
      // "Your pagehaul unlock link" alike.
      const uids = await client.search(
        { to: email, subject: "unlock" },
        { uid: true },
      );
      if (!uids || uids.length === 0) return null;
      // Newest first; the most recent valid token is the live plan.
      const recent = uids.slice(-5).reverse();
      for (const uid of recent) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const body = msg.source.toString("utf8");
        for (const m of body.matchAll(TOKEN_RE)) {
          let token: string;
          try {
            token = decodeURIComponent(m[1]);
          } catch {
            continue;
          }
          // Quoted-printable mail wraps long lines with "=\r\n"; heal them.
          token = token.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
          const payload = verifyLicense(token);
          if (payload) return { payload, token };
        }
      }
      return null;
    } finally {
      lock.release();
    }
  } catch (e) {
    console.error("ledger lookup failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    client.logout().catch(() => {});
  }
}
