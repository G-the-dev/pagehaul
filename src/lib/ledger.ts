import { ImapFlow } from "imapflow";
import {
  verifyLicense,
  verifyLicenseAnyTime,
  type LicensePayload,
} from "./license";

/**
 * The purchase ledger is the Gmail Sent folder.
 *
 * Every unlock email ever sent sits there, addressed to its buyer and
 * carrying the restore link, which carries the signed token, which carries
 * the plan, its expiry, and any queued start date. Searching sent mail by
 * recipient IS the lookup "what does this email own", with no database to
 * run, back up, or lose. Missing credentials fail open: no ledger means no
 * block, never a broken checkout.
 */

const TOKEN_RE = /#restore=([A-Za-z0-9._%\-]+)/g;

export interface OwnedPlans {
  /** The plan live right now, if any. */
  current?: { payload: LicensePayload; token: string };
  /** A purchase waiting for its start date, if any. */
  queued?: { payload: LicensePayload; token: string };
}

export async function findOwnedPlans(email: string): Promise<OwnedPlans> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return {};

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const out: OwnedPlans = {};
  try {
    await client.connect();
    const lock = await client.getMailboxLock("[Gmail]/Sent Mail");
    try {
      // Recipient only: Gmail's IMAP matches subjects by whole word, so
      // "unlock" never found "unlocked" and the ledger came up empty. This
      // account sends nothing but product mail, and token verification
      // below is the real filter anyway.
      const uids = await client.search({ to: email }, { uid: true });
      if (!uids || uids.length === 0) return out;
      const recent = uids.slice(-8).reverse();
      for (const uid of recent) {
        if (out.current && out.queued) break;
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        // Quoted-printable mail folds long lines with "=\r\n" and writes
        // "=" as "=3D", straight through the middle of a restore URL, and
        // sometimes through the word "restore" itself. Heal the whole body
        // before looking for anything, or every extracted token is a
        // truncated stub that verifies as nothing.
        const body = msg.source
          .toString("utf8")
          .replace(/=\r?\n/g, "")
          .replace(/=3D/g, "=");
        for (const m of body.matchAll(TOKEN_RE)) {
          let token: string;
          try {
            token = decodeURIComponent(m[1]);
          } catch {
            continue;
          }
          const live = verifyLicense(token);
          if (live && !out.current) {
            out.current = { payload: live, token };
            continue;
          }
          const any = verifyLicenseAnyTime(token);
          if (any && any.nbf && any.nbf > Date.now() && !out.queued) {
            out.queued = { payload: any, token };
          }
        }
      }
      return out;
    } finally {
      lock.release();
    }
  } catch (e) {
    console.error("ledger lookup failed:", e instanceof Error ? e.message : e);
    return out;
  } finally {
    client.logout().catch(() => {});
  }
}
