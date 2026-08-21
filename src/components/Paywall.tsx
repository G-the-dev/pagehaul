"use client";

import { useEffect, useState } from "react";
import { Check, Lock, X } from "lucide-react";
import { track } from "@/lib/analytics";
import {
  FREE_DEEP_SITES,
  PACK_PRICE_INR,
  PACK_SCANS,
  PRO_PRICE_INR,
  storeLicense,
} from "@/lib/plan";

/**
 * The plans, and the moment of asking for money.
 *
 * One grid serves the pricing page and the paywall dialog, so the numbers
 * can never drift apart. Checkout goes through Razorpay's widget; until the
 * keys exist in the environment the buttons answer honestly that payments
 * are opening shortly, and every view and click is tracked so the pricing
 * has evidence behind it before a rupee moves.
 */

type PaywallReason = "limit" | "design" | "model" | "pricing";

const HEADLINES: Record<PaywallReason, { title: string; body: string }> = {
  limit: {
    title: "You have used your free deep scans",
    body: `The free plan covers ${FREE_DEEP_SITES} deep-scanned sites — rescanning those stays free. For everything else, there is Pro.`,
  },
  design: {
    title: "The design system is part of Pro",
    body: "Palette, typography and design tokens, read from the page as a browser paints it.",
  },
  model: {
    title: "3D files are part of Pro",
    body: "Preview and download every model a page loads — GLB, glTF and the rest.",
  },
  pricing: {
    title: "Simple pricing, in rupees",
    body: "Quick scans are free forever. Deep scans and the good stuff cost less than a coffee.",
  },
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function PlansGrid({
  onUnlocked,
  origin,
}: {
  /** Called with nothing when a purchase completes and the license is stored. */
  onUnlocked?: () => void;
  /** Where the grid is shown, for analytics. */
  origin: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  const buy = async (plan: "pro" | "pack") => {
    if (busyPlan) return;
    setBusyPlan(plan);
    setNote(null);
    track("checkout_clicked", { plan, origin });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        orderId?: string;
        keyId?: string;
        amount?: number;
        currency?: string;
        label?: string;
      };
      if (res.status === 503 && data.code === "not_live") {
        track("checkout_not_live", { plan, origin });
        setNote(
          "Payments are opening in a few days — UPI, cards and netbanking. Want it today? Say so through the Feedback button and you will be first in line.",
        );
        return;
      }
      if (!res.ok || !data.orderId) {
        setNote(data.error ?? "Checkout could not start. Try again in a moment.");
        return;
      }
      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) {
        setNote("The payment widget could not load. Check your connection and try again.");
        return;
      }
      new window.Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: data.currency,
        name: "pagehaul",
        description: data.label,
        theme: { color: "#111111" },
        handler: async (rsp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verify = await fetch("/api/checkout", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ plan, ...rsp }),
          });
          const out = (await verify.json()) as { token?: string; error?: string };
          if (out.token) {
            storeLicense(out.token);
            track("purchase", { plan, origin });
            onUnlocked?.();
          } else {
            setNote(out.error ?? "The payment went through but could not be verified — contact us and we will fix it.");
          }
        },
      }).open();
    } catch {
      setNote("Checkout could not start. Try again in a moment.");
    } finally {
      setBusyPlan(null);
    }
  };

  const tick = (children: React.ReactNode) => (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
      <span>{children}</span>
    </li>
  );

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-[13px] font-semibold">Free</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">₹0</div>
          <ul className="mt-4 space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {tick("Unlimited quick scans")}
            {tick(`${FREE_DEEP_SITES} deep-scanned sites, rescans free`)}
            {tick("Images, icons, video, audio, fonts, screenshots")}
            <li className="flex items-start gap-2 opacity-60">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Design system and 3D files stay locked</span>
            </li>
          </ul>
        </div>

        <div className="relative rounded-xl border border-accent/40 bg-surface p-5 shadow-soft">
          <div className="text-[13px] font-semibold">Pro</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            ₹{PRO_PRICE_INR}
            <span className="ml-1 text-[12.5px] font-normal text-muted-foreground">/ month</span>
          </div>
          <ul className="mt-4 space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {tick("Unlimited deep scans")}
            {tick("Design system: palette, type, tokens")}
            {tick("3D previews and downloads")}
            {tick("Everything in Free")}
          </ul>
          <button
            type="button"
            onClick={() => buy("pro")}
            disabled={busyPlan !== null}
            className="mt-5 w-full rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busyPlan === "pro" ? "Opening checkout…" : "Get Pro"}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-[13px] font-semibold">Scan pack</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            ₹{PACK_PRICE_INR}
            <span className="ml-1 text-[12.5px] font-normal text-muted-foreground">once</span>
          </div>
          <ul className="mt-4 space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {tick(`${PACK_SCANS} deep scans, everything unlocked`)}
            {tick("No subscription — spend them in a year")}
            {tick("UPI, cards, netbanking")}
          </ul>
          <button
            type="button"
            onClick={() => buy("pack")}
            disabled={busyPlan !== null}
            className="mt-5 w-full rounded-md border border-border px-4 py-2 text-[13px] font-semibold transition-colors hover:border-border-strong disabled:opacity-50"
          >
            {busyPlan === "pack" ? "Opening checkout…" : "Buy a pack"}
          </button>
        </div>
      </div>

      {note && (
        <p className="mt-4 rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}

export function Paywall({
  reason,
  onClose,
  onUnlocked,
}: {
  reason: PaywallReason;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  useEffect(() => {
    track("paywall_shown", { reason });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reason, onClose]);

  const head = HEADLINES[reason];
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-5 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Pricing"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{head.title}</h2>
            <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">
              {head.body}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>
        <div className="mt-6">
          <PlansGrid origin={`paywall:${reason}`} onUnlocked={onUnlocked} />
        </div>
      </div>
    </div>
  );
}
