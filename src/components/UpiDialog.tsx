"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { track } from "@/lib/analytics";
import { PACK_PRICE_INR, PACK_SCANS, PRO_PRICE_INR, storeLicense } from "@/lib/plan";
import { UPI } from "@/lib/upi-config";

/**
 * The UPI checkout. Opening it is the claim: the owner is notified at once,
 * the dialog polls from the first second, and the buyer's only job is to
 * pay before the four-minute clock runs out. When the owner confirms the
 * money, the license installs itself and the page unlocks; no button needs
 * pressing in between.
 *
 * Rendered through a portal to the body: inside the pricing card's animated
 * wrapper, position:fixed answers to the transformed ancestor rather than
 * the viewport, which is how the dialog ended up underneath the nav with a
 * backdrop that flickered on scroll.
 */

const WINDOW_S = 4 * 60;

function makeRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return "PH-" + [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

type Stage = "pay" | "done" | "expired" | "paste";

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
  const [ref, setRef] = useState(makeRef);
  const [stage, setStage] = useState<Stage>("pay");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [left, setLeft] = useState(WINDOW_S);
  const [mounted, setMounted] = useState(false);
  const claimedFor = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);

  // The page behind holds still; a scrolling backdrop is what made the
  // blur stutter, and there is nothing back there to reach mid-payment.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const upiUrl = `upi://pay?pa=${encodeURIComponent(UPI.vpa)}&am=${amount}&cu=INR&tn=${encodeURIComponent(ref)}`;

  useEffect(() => {
    let alive = true;
    import("qrcode").then((QR) =>
      QR.toDataURL(upiUrl, { margin: 1, width: 480 }).then((url) => {
        if (alive) setQr(url);
      }),
    );
    return () => {
      alive = false;
    };
  }, [upiUrl]);

  useEffect(() => {
    track("upi_dialog", { plan });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening the dialog IS the claim. One notification per reference.
  useEffect(() => {
    if (stage !== "pay" || claimedFor.current === ref) return;
    claimedFor.current = ref;
    (async () => {
      try {
        const res = await fetch("/api/upi/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan, email, ref }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setProblem(data.error ?? "Could not start the payment. Close and try again.");
          return;
        }
        track("upi_claimed", { plan });
      } catch {
        setProblem("Could not start the payment. Close and try again.");
      }
    })();
  }, [stage, ref, plan, email]);

  const finish = useCallback(
    (token: string) => {
      storeLicense(token);
      track("purchase", { plan, origin: "upi" });
      setStage("done");
      window.setTimeout(() => onUnlocked(), 1600);
    },
    [plan, onUnlocked],
  );

  // The clock: four minutes to pay, counted where the buyer can see it.
  useEffect(() => {
    if (stage !== "pay") return;
    setLeft(WINDOW_S);
    const t0 = Date.now();
    const t = window.setInterval(() => {
      const remaining = WINDOW_S - Math.floor((Date.now() - t0) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(t);
        setStage("expired");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [stage, ref]);

  // Polling starts with the dialog, so a fast payer never touches a button.
  useEffect(() => {
    if (stage !== "pay") return;
    let alive = true;
    let timer: number;
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
      if (alive) timer = window.setTimeout(poll, 5000);
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [stage, ref, finish]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/80 p-5 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Pay with UPI"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-background p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="mb-4 pr-10">
          <h2 className="text-[17px] font-semibold tracking-tight">Pay with UPI</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {label} · ₹{amount}
          </p>
        </div>

        {stage === "pay" && (
          <>
            <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="UPI payment QR" className="h-48 w-48" />
              ) : (
                <div className="h-48 w-48 animate-pulse rounded-lg bg-neutral-200" />
              )}
            </div>

            {/* The facts in one line: address, amount, reference. */}
            <div className="mt-3.5 flex items-stretch divide-x divide-border rounded-lg border border-border text-[12px]">
              <button
                type="button"
                onClick={() => copy(UPI.vpa)}
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2 font-mono text-[11.5px]"
                title="Copy UPI ID"
              >
                <span className="truncate">{UPI.vpa}</span>
                {copied ? (
                  <Check className="h-3 w-3 shrink-0" aria-hidden />
                ) : (
                  <Copy className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                )}
              </button>
              <span className="grid shrink-0 place-items-center px-3 font-semibold">
                ₹{amount}
              </span>
              <span className="grid shrink-0 place-items-center px-3 font-mono text-[11.5px] text-muted-foreground">
                {ref}
              </span>
            </div>

            {problem ? (
              <p className="mt-3 text-center text-[12.5px] text-red-400/90">{problem}</p>
            ) : (
              <div className="mt-3.5 flex items-center justify-center gap-2.5 text-[12.5px] text-muted-foreground">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-border border-t-foreground" />
                Waiting for your payment
                <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11.5px] tabular-nums">
                  {mm}:{ss}
                </span>
              </div>
            )}
            <p className="mt-2 text-center text-[11.5px] leading-relaxed text-muted-foreground/80">
              Pay within the time and this page unlocks by itself.
              Confirmation lands at {email} too.
            </p>
            <button
              type="button"
              onClick={() => setStage("paste")}
              className="mt-2 w-full text-center text-[11.5px] text-muted-foreground/70 underline underline-offset-2"
            >
              Have a license from a previous payment?
            </button>
          </>
        )}

        {stage === "expired" && (
          <div className="py-6 text-center">
            <p className="text-[15px] font-semibold">The payment window closed</p>
            <p className="mx-auto mt-1.5 max-w-[32ch] text-[12.5px] leading-relaxed text-muted-foreground">
              If you already paid, your license arrives at {email}. Otherwise
              start again with a fresh code.
            </p>
            <button
              type="button"
              onClick={() => {
                setProblem(null);
                setRef(makeRef());
                setStage("pay");
              }}
              className="mt-5 rounded-full bg-accent px-6 py-2.5 text-[14px] font-semibold text-accent-fg"
            >
              Start again
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
              onClick={() => {
                setProblem(null);
                setStage("pay");
              }}
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
    </div>,
    document.body,
  );
}
