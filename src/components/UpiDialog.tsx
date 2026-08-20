"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { track } from "@/lib/analytics";
import { PACK_PRICE_INR, PACK_SCANS, PRO_PRICE_INR, storeLicense } from "@/lib/plan";
import { UPI } from "@/lib/upi-config";

/**
 * The UPI checkout: a QR with the amount and a reference baked in, the
 * payee's name and address beside it, and a patient little state machine.
 * "I have paid" registers the claim; the dialog then polls until the owner,
 * who can see the money, approves it — at which point the license installs
 * itself and the page unlocks. A paste box covers the one case where the
 * approval and the poll land on different servers.
 */

function makeRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return "PH-" + [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

type Stage = "pay" | "waiting" | "done" | "paste";

export function UpiDialog({
  plan,
  email,
  onClose,
  onUnlocked,
}: {
  plan: "pro" | "pack";
  email: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const amount = plan === "pro" ? PRO_PRICE_INR : PACK_PRICE_INR;
  const label = plan === "pro" ? "Pro, one month" : `${PACK_SCANS} deep scans`;
  const [ref] = useState(makeRef);
  const [stage, setStage] = useState<Stage>("pay");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  const upiUrl = `upi://pay?pa=${encodeURIComponent(UPI.vpa)}&am=${amount}&cu=INR&tn=${encodeURIComponent(ref)}`;

  useEffect(() => {
    track("upi_dialog", { plan });
    let alive = true;
    import("qrcode").then((QR) =>
      QR.toDataURL(upiUrl, { margin: 1, width: 480 }).then((url) => {
        if (alive) setQr(url);
      }),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(
    (token: string) => {
      storeLicense(token);
      track("purchase", { plan, origin: "upi" });
      setStage("done");
      window.setTimeout(() => {
        onUnlocked();
      }, 1600);
    },
    [plan, onUnlocked],
  );

  const claim = useCallback(async () => {
    setProblem(null);
    try {
      const res = await fetch("/api/upi/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, email, ref }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setProblem(data.error ?? "Could not register the payment. Try again.");
        return;
      }
      track("upi_claimed", { plan });
      setStage("waiting");
    } catch {
      setProblem("Could not register the payment. Try again.");
    }
  }, [plan, email, ref]);

  // While waiting, ask every five seconds whether the owner approved.
  useEffect(() => {
    if (stage !== "waiting") return;
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/upi/status?ref=${ref}`);
        const data = (await res.json()) as { token?: string };
        if (alive && data.token) {
          finish(data.token);
          return;
        }
      } catch {
        /* transient; the next poll tries again */
      }
      if (alive) pollTimer.current = window.setTimeout(poll, 5000);
    };
    poll();
    return () => {
      alive = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [stage, ref, finish]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/80 p-5 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Pay with UPI"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight">Pay with UPI</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {label} · ₹{amount}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>

        {stage === "pay" && (
          <>
            <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="UPI payment QR" className="h-52 w-52" />
              ) : (
                <div className="h-52 w-52 animate-pulse rounded-lg bg-neutral-200" />
              )}
            </div>
            <div className="mt-4 space-y-2 text-[13px]">
              <button
                type="button"
                onClick={() => copy(UPI.vpa)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <span className="text-muted-foreground">UPI ID</span>
                <span className="flex items-center gap-1.5 font-mono text-[12.5px]">
                  {UPI.vpa}
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5 opacity-60" aria-hidden />
                  )}
                </span>
              </button>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">₹{amount}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-mono text-[12.5px]">{ref}</span>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
              Scan with any UPI app, or pay to the UPI ID with the exact amount.
              The reference rides along in the payment note.
            </p>
            {problem && (
              <p className="mt-2 text-[12.5px] text-red-400/90">{problem}</p>
            )}
            <button
              type="button"
              onClick={claim}
              className="mt-4 w-full rounded-full bg-accent px-6 py-3 text-[14px] font-semibold text-accent-fg"
            >
              I have paid ₹{amount}
            </button>
            <button
              type="button"
              onClick={() => setStage("paste")}
              className="mt-2 w-full text-center text-[12.5px] text-muted-foreground underline underline-offset-2"
            >
              Already paid? Enter your license
            </button>
          </>
        )}

        {stage === "waiting" && (
          <div className="py-6 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
            <p className="mt-4 text-[14px] font-medium">Confirming your payment</p>
            <p className="mx-auto mt-1.5 max-w-[30ch] text-[12.5px] leading-relaxed text-muted-foreground">
              Usually a few minutes. This page unlocks by itself, and the
              license also goes to {email}.
            </p>
            <button
              type="button"
              onClick={() => setStage("paste")}
              className="mt-5 text-[12.5px] text-muted-foreground underline underline-offset-2"
            >
              Got the license by email? Paste it
            </button>
          </div>
        )}

        {stage === "paste" && (
          <div>
            <p className="mb-2 text-[13px] text-muted-foreground">
              Paste the license from your email:
            </p>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface p-3 font-mono text-[11.5px] focus:border-border-strong focus:outline-none"
              placeholder="v1.eyJw…"
            />
            <button
              type="button"
              onClick={() => {
                const t = pasted.trim();
                if (t.startsWith("v1.")) finish(t);
                else setProblem("That does not look like a license.");
              }}
              className="mt-3 w-full rounded-full bg-accent px-6 py-3 text-[14px] font-semibold text-accent-fg"
            >
              Unlock
            </button>
            {problem && (
              <p className="mt-2 text-[12.5px] text-red-400/90">{problem}</p>
            )}
            <button
              type="button"
              onClick={() => setStage("pay")}
              className="mt-2 w-full text-center text-[12.5px] text-muted-foreground underline underline-offset-2"
            >
              Back to payment
            </button>
          </div>
        )}

        {stage === "done" && (
          <div className="py-8 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-fg">
              <Check className="h-5 w-5" aria-hidden />
            </div>
            <p className="mt-4 text-[15px] font-semibold">Payment confirmed</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Everything is unlocked. Enjoy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
