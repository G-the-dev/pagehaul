"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { track } from "@/lib/analytics";
import {
  FREE_DEEP_SCANS,
  PACK_PRICE_INR,
  PACK_SCANS,
  PRO_PRICE_INR,
  storeLicense,
} from "@/lib/plan";
import { Section, Reveal, Chip } from "./ui/motion-primitives";

/**
 * The plans, and the moment of asking for money.
 *
 * One pair of cards serves the landing page and the paywall dialog, so the
 * numbers can never drift apart. Checkout goes through Razorpay's widget;
 * until the keys exist in the environment the buttons answer honestly that
 * payments are opening shortly, and every view and click is tracked so the
 * pricing has evidence behind it before a rupee moves.
 */

type PaywallReason = "limit" | "design" | "locked" | "pricing";

const HEADLINES: Record<PaywallReason, { title: string; body: string }> = {
  limit: {
    title: "You have used your free deep scans",
    body: `The free plan covers ${FREE_DEEP_SCANS} deep scans. Everything past that is Pro.`,
  },
  design: {
    title: "The design system is part of Pro",
    body: "Colours, fonts and design tokens, read from the page as a browser paints it.",
  },
  locked: {
    title: "Audio, screenshots and 3D are part of Pro",
    body: "Preview and download everything a deep scan finds, with nothing held back.",
  },
  pricing: {
    title: "Simple pricing, in rupees",
    body: "Quick scans are free forever. The full toolkit costs less than a pizza.",
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

function Tick({
  children,
  dim,
}: {
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <li className={`flex items-start gap-2.5 ${dim ? "opacity-55" : ""}`}>
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export function PlansGrid({
  onUnlocked,
  origin,
  onFreeCta,
}: {
  /** Called with nothing when a purchase completes and the license is stored. */
  onUnlocked?: () => void;
  /** Where the grid is shown, for analytics. */
  origin: string;
  /** Inside the dialog the free button closes it; on the page it jumps to the scanner. */
  onFreeCta?: () => void;
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
          "Payments are opening in a few days, with UPI, cards and netbanking. Want it today? Say so through the Feedback button and you will be first in line.",
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
            setNote(
              out.error ??
                "The payment went through but could not be verified. Contact us and we will fix it.",
            );
          }
        },
      }).open();
    } catch {
      setNote("Checkout could not start. Try again in a moment.");
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Free: the quiet card. */}
        <div className="relative rounded-2xl border border-border bg-surface px-7 pb-7 pt-9">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-background px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Free
          </span>
          <div className="text-center">
            <div className="text-3xl font-semibold tracking-tight">₹0</div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              For a first look at what a page is made of.
            </p>
            {onFreeCta ? (
              <button
                type="button"
                onClick={onFreeCta}
                className="mt-5 rounded-full border border-border px-6 py-2.5 text-[13px] font-semibold transition-colors hover:border-border-strong"
              >
                Keep scanning free
              </button>
            ) : (
              <a
                href="#top"
                className="mt-5 inline-block rounded-full border border-border px-6 py-2.5 text-[13px] font-semibold transition-colors hover:border-border-strong"
              >
                Start scanning
              </a>
            )}
          </div>
          <div className="mt-7 border-t border-border pt-6">
            <ul className="space-y-2.5 text-[13px] leading-relaxed text-fg-2">
              <Tick>Unlimited quick scans</Tick>
              <Tick>{FREE_DEEP_SCANS} deep scans</Tick>
              <Tick>Images, icons, video, fonts and docs</Tick>
            </ul>
          </div>
        </div>

        {/* Pro: the loud card. Inverted, the way the brand does emphasis. */}
        <div className="relative rounded-2xl bg-foreground px-7 pb-7 pt-9 text-background">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-md bg-foreground px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-background ring-1 ring-border">
            Pro
          </span>
          <div className="text-center">
            <div className="text-3xl font-semibold tracking-tight">
              ₹{PRO_PRICE_INR}
              <span className="ml-1.5 text-[13px] font-normal opacity-70">/ month</span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed opacity-70">
              For people who take things from the web daily.
            </p>
            <button
              type="button"
              onClick={() => buy("pro")}
              disabled={busyPlan !== null}
              className="mt-5 rounded-full bg-background px-6 py-2.5 text-[13px] font-semibold text-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busyPlan === "pro" ? "Opening checkout…" : "Get Pro"}
            </button>
          </div>
          <div className="mt-7 border-t border-background/20 pt-6">
            <ul className="space-y-2.5 text-[13px] leading-relaxed opacity-90">
              <Tick>Unlimited deep scans</Tick>
              <Tick>Audio, screenshots and 3D files</Tick>
              <Tick>The design system: colours, fonts, tokens</Tick>
              <Tick>Everything in Free</Tick>
            </ul>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/10 px-4 py-3">
              <p className="text-[12.5px] opacity-90">
                One-time instead: ₹{PACK_PRICE_INR} for {PACK_SCANS} deep scans.
              </p>
              <button
                type="button"
                onClick={() => buy("pack")}
                disabled={busyPlan !== null}
                className="rounded-full border border-background/40 px-4 py-1.5 text-[12px] font-semibold transition-colors hover:border-background disabled:opacity-50"
              >
                {busyPlan === "pack" ? "Opening…" : "Buy a pack"}
              </button>
            </div>
          </div>
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

/** The pricing block on the landing page itself. */
export function PricingSection() {
  return (
    <Section id="pricing">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <div className="mb-12 text-center">
            <Chip>Pricing</Chip>
            <h2 className="mt-6 text-[2rem] font-medium leading-[1.12] tracking-tight sm:text-[2.5rem]">
              Free to try.
              <br />
              Cheap to keep.
            </h2>
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <PlansGrid origin="landing" />
        </Reveal>
      </div>
    </Section>
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
        <div className="mb-7 flex items-start justify-between gap-6">
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
        <PlansGrid
          origin={`paywall:${reason}`}
          onUnlocked={onUnlocked}
          onFreeCta={onClose}
        />
      </div>
    </div>
  );
}
