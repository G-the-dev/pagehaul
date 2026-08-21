"use client";

import { useEffect, useState } from "react";
import { Check, X, Zap, Layers, Package } from "lucide-react";
import { GrainGradient } from "@paper-design/shaders-react";
import { track } from "@/lib/analytics";
import {
  FREE_DEEP_SCANS,
  PACK_PRICE_INR,
  PACK_SCANS,
  PRO_PRICE_INR,
  licenseEmail,
  licensePlan,
  packScansLeft,
  planExpiry,
  queuedPlan,
  storeLicense,
} from "@/lib/plan";
import { Section, Reveal, Chip } from "./ui/motion-primitives";
import { useIsLight } from "@/lib/use-is-light";
import { useInView } from "@/lib/use-in-view";
import { upiLive } from "@/lib/upi-config";
import { UpiDialog } from "./UpiDialog";

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

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border bg-background/50">
        <Check className="h-3 w-3 text-muted-foreground" aria-hidden />
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * One pricing card: paper-shader ground, icon tile and badge, name against
 * price, a hairline, the list, and whatever the footer needs. The shader is
 * a slow grain gradient in the theme's own greys — texture, not spectacle —
 * and it only mounts on the client because it is a canvas.
 */
function PlanCard({
  icon,
  badge,
  badgeStrong,
  title,
  price,
  priceSuffix,
  desc,
  ticks,
  footer,
  shades,
  active,
  onActivate,
}: {
  icon: React.ReactNode;
  badge: string;
  badgeStrong?: boolean;
  title: string;
  price: string;
  priceSuffix?: string;
  desc: string;
  ticks: React.ReactNode;
  footer: React.ReactNode;
  shades: { back: string; colors: string[] };
  active?: boolean;
  onActivate?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [viewRef, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={viewRef}
      onClick={onActivate}
      onFocusCapture={onActivate}
      className={"relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft " + (
        active
          ? "border-border-strong shadow-soft"
          : "border-border hover:border-border-strong"
      )}
      style={{ backgroundColor: shades.back }}
    >
      {mounted && inView && (
        <GrainGradient
          colorBack={shades.back}
          colors={shades.colors}
          softness={0.9}
          intensity={0.12}
          noise={0.35}
          speed={0.4}
          minPixelRatio={1}
          maxPixelCount={280_000}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      )}
      <div className="relative flex h-full flex-col p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/60">
            {icon}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
              badgeStrong
                ? "border-accent-line bg-accent-soft text-foreground"
                : "border-border bg-background/60 text-muted-foreground"
            }`}
          >
            {badge}
          </span>
        </div>
        <div className="mt-5 flex items-baseline justify-between gap-3">
          <h3 className="text-[19px] font-semibold tracking-tight">{title}</h3>
          <div className="text-[28px] font-semibold leading-none tracking-tight">
            {price}
            {priceSuffix && (
              <span className="ml-1 text-[13px] font-normal text-muted-foreground">
                {priceSuffix}
              </span>
            )}
          </div>
        </div>
        <p className="mt-2 min-h-[46px] text-[14px] leading-relaxed text-muted-foreground">{desc}</p>
        <div className="my-5 h-px bg-border" />
        <ul className="space-y-3 text-[14px] leading-relaxed text-fg-2">{ticks}</ul>
        <div className="mt-auto pt-6">{footer}</div>
      </div>
    </div>
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
  // The buyer's email: required before checkout opens. It is where the
  // receipt goes and the one handle support has to restore a license for a
  // browser that lost its storage.
  const [email, setEmail] = useState("");
  const [emailNeededFor, setEmailNeededFor] = useState<"pro" | "pack" | null>(null);
  // Which card the person is leaning toward: click or focus marks it, and
  // the card firms its border so the choice is visible without shouting.
  const [activeCard, setActiveCard] = useState<"free" | "pro" | "pack" | null>(null);
  const [upiPlan, setUpiPlan] = useState<"pro" | "pack" | null>(null);
  // What this browser already owns, so the cards tell the truth: an owned
  // Pro cannot be bought twice, an owned pack offers a refill.
  const [owned, setOwned] = useState<"pro" | "pack" | null>(null);
  const [scansLeft, setScansLeft] = useState(0);
  const [renewWindow, setRenewWindow] = useState(false);
  const [queued, setQueued] = useState<"pro" | "pack" | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      setOwned(licensePlan());
      setScansLeft(packScansLeft());
      setOwnerEmail(licenseEmail());
      const exp = planExpiry();
      setRenewWindow(
        licensePlan() === "pro" &&
          exp !== null &&
          exp - Date.now() <= 7 * 24 * 60 * 60_000,
      );
      setQueued(queuedPlan());
    };
    read();
    window.addEventListener("ph-plan-changed", read);
    return () => window.removeEventListener("ph-plan-changed", read);
  }, []);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const buy = async (plan: "pro" | "pack") => {
    if (busyPlan) return;
    if (!emailOk) {
      setEmailNeededFor(plan);
      return;
    }
    track("checkout_clicked", { plan, origin });
    // UPI first: when the address is configured, the QR dialog is the whole
    // checkout. The gateway path below stays wired for the day a gateway
    // account exists.
    if (upiLive()) {
      setUpiPlan(plan);
      return;
    }
    setBusyPlan(plan);
    setNote(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, email: email.trim() }),
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
        prefill: { email: email.trim() },
        theme: { color: "#111111" },
        handler: async (rsp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verify = await fetch("/api/checkout", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ plan, email: email.trim(), ...rsp }),
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

  const light = useIsLight();
  const SHADES = light
    ? {
        free: { back: "#fafafa", colors: ["#f1f1ef", "#e9e9e7", "#f5f5f3"] },
        pro: { back: "#f2f2f4", colors: ["#e7e7ea", "#dcdce1", "#efeff1"] },
        pack: { back: "#fafafa", colors: ["#f0f0ee", "#e8e8e6", "#f4f4f2"] },
      }
    : {
        free: { back: "#0b0b0c", colors: ["#141415", "#1a1a1c", "#101011"] },
        pro: { back: "#121214", colors: ["#1d1d20", "#242428", "#161618"] },
        pack: { back: "#0b0b0c", colors: ["#121214", "#19191b", "#0e0e0f"] },
      };

  const emailInput = (plan: "pro" | "pack") => (
    <>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailNeededFor) setEmailNeededFor(null);
        }}
        placeholder="you@studio.com"
        aria-label="Email for your receipt and license"
        className={`block w-full rounded-full border bg-background px-5 py-2.5 text-[14px] focus:outline-none ${
          emailNeededFor === plan
            ? "border-red-400/80"
            : "border-border focus:border-border-strong"
        }`}
      />
      {/* A fixed-height line whether or not it has anything to say, so the
          hint can appear without the card growing and dragging its
          neighbours' heights with it. */}
      <p className="flex h-[24px] items-center px-2 text-[12px] leading-none text-red-400/90">
        {emailNeededFor === plan ? "Enter your email first. The receipt goes there." : ""}
      </p>
    </>
  );

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        <PlanCard
          icon={<Zap className="h-4 w-4" aria-hidden />}
          active={activeCard === "free"}
          onActivate={() => setActiveCard("free")}
          badge="Start here"
          title="Free"
          price="₹0"
          desc="For a first look at what a page is made of."
          shades={SHADES.free}
          ticks={
            <>
              <Tick>Unlimited quick scans</Tick>
              <Tick>{FREE_DEEP_SCANS} deep scans</Tick>
              <Tick>Images, icons, video, fonts and docs</Tick>
            </>
          }
          footer={
            onFreeCta ? (
              <button
                type="button"
                onClick={onFreeCta}
                className="block w-full rounded-full border border-border bg-surface-2 px-6 py-3 text-center text-[14px] font-semibold text-fg-2 disabled:opacity-50"
              >
                Keep scanning free
              </button>
            ) : (
              <a
                href="#top"
                className="block w-full rounded-full border border-border bg-surface-2 px-6 py-3 text-center text-[14px] font-semibold text-fg-2 disabled:opacity-50"
              >
                Start scanning
              </a>
            )
          }
        />

        <PlanCard
          icon={<Layers className="h-4 w-4" aria-hidden />}
          active={activeCard === "pro"}
          onActivate={() => setActiveCard("pro")}
          badge="Best value"
          badgeStrong
          title="Pro"
          price={`₹${PRO_PRICE_INR}`}
          priceSuffix="/ month"
          desc="For people who take things from the web every day."
          shades={SHADES.pro}
          ticks={
            <>
              <Tick>Unlimited deep scans</Tick>
              <Tick>Audio, screenshots and 3D files</Tick>
              <Tick>The design system: colours, fonts, tokens</Tick>
              <Tick>Everything in Free</Tick>
            </>
          }
          footer={
            owned === "pro" && queued === "pro" ? (
              <div className="w-full rounded-full border border-accent-line bg-accent-soft px-6 py-3 text-center text-[14px] font-semibold">
                Renewed ✓
              </div>
            ) : owned === "pro" && renewWindow ? (
              <>
                {emailInput("pro")}
                <button
                  type="button"
                  onClick={() => buy("pro")}
                  disabled={busyPlan !== null}
                  className="w-full rounded-full bg-accent px-6 py-3 text-center text-[14px] font-semibold text-accent-fg disabled:opacity-50"
                >
                  {busyPlan === "pro"
                    ? "Opening checkout…"
                    : `Renew Pro · ₹${PRO_PRICE_INR}`}
                </button>
              </>
            ) : owned === "pro" ? (
              <div>
                <div className="w-full rounded-full border border-accent-line bg-accent-soft px-6 py-3 text-center text-[14px] font-semibold">
                  Your current plan ✓
                </div>
                {ownerEmail && (
                  <p className="mt-2 truncate text-center font-mono text-[11px] text-muted-foreground">
                    on {ownerEmail}
                  </p>
                )}
              </div>
            ) : (
              <>
                {emailInput("pro")}
                <button
                  type="button"
                  onClick={() => buy("pro")}
                  disabled={busyPlan !== null}
                  className="w-full rounded-full bg-accent px-6 py-3 text-center text-[14px] font-semibold text-accent-fg disabled:opacity-50"
                >
                  {busyPlan === "pro" ? "Opening checkout…" : `Get Pro for ₹${PRO_PRICE_INR}/mo`}
                </button>
              </>
            )
          }
        />

        <PlanCard
          icon={<Package className="h-4 w-4" aria-hidden />}
          active={activeCard === "pack"}
          onActivate={() => setActiveCard("pack")}
          badge="One-time"
          title="Scan pack"
          price={`₹${PACK_PRICE_INR}`}
          desc="A pocketful of deep scans, no subscription."
          shades={SHADES.pack}
          ticks={
            <>
              <Tick>{PACK_SCANS} deep scans</Tick>
              <Tick>Everything Pro unlocks, on every scan</Tick>
              <Tick>A year to spend them</Tick>
            </>
          }
          footer={
            owned === "pro" && queued === "pack" ? (
              <div className="w-full rounded-full border border-accent-line bg-accent-soft px-6 py-3 text-center text-[14px] font-semibold">
                Queued after Pro ✓
              </div>
            ) : owned === "pro" && renewWindow ? (
              <>
                {emailInput("pack")}
                <button
                  type="button"
                  onClick={() => buy("pack")}
                  disabled={busyPlan !== null}
                  className="w-full rounded-full border border-border bg-surface-2 px-6 py-3 text-center text-[14px] font-semibold text-fg-2 disabled:opacity-50"
                >
                  {busyPlan === "pack"
                    ? "Opening checkout…"
                    : `Buy for after Pro · ₹${PACK_PRICE_INR}`}
                </button>
              </>
            ) : owned === "pro" ? (
              <div className="w-full rounded-full border border-border px-6 py-3 text-center text-[14px] font-semibold text-muted-foreground">
                Included in Pro
              </div>
            ) : (
              <>
                {owned === "pack" && (
                  <p className="mb-2 truncate text-center font-mono text-[12px] text-muted-foreground">
                    {scansLeft} scan{scansLeft === 1 ? "" : "s"} left
                    {ownerEmail ? ` · ${ownerEmail}` : ""}
                  </p>
                )}
                {emailInput("pack")}
                <button
                  type="button"
                  onClick={() => buy("pack")}
                  disabled={busyPlan !== null}
                  className="w-full rounded-full border border-border bg-surface-2 px-6 py-3 text-center text-[14px] font-semibold text-fg-2 disabled:opacity-50"
                >
                  {busyPlan === "pack"
                    ? "Opening checkout…"
                    : owned === "pack"
                      ? `Refill · ${PACK_SCANS} more for ₹${PACK_PRICE_INR}`
                      : `Buy ${PACK_SCANS} scans for ₹${PACK_PRICE_INR}`}
                </button>
              </>
            )
          }
        />
      </div>

      {note && (
        <p className="mt-4 rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground">
          {note}
        </p>
      )}

      {upiPlan && (
        <UpiDialog
          plan={upiPlan}
          email={email.trim()}
          onClose={() => setUpiPlan(null)}
          onPaid={() => {
            window.dispatchEvent(new Event("ph-plan-changed"));
            if (onUnlocked) onUnlocked();
          }}
        />
      )}
    </div>
  );
}

/** The pricing block on the landing page itself. */
export function PricingSection() {
  return (
    <Section id="pricing">
      <Reveal>
        <div className="mb-14">
          <Chip>Pricing</Chip>
          <h2 className="mt-6 max-w-md text-[2.15rem] font-medium leading-[1.12] tracking-tight sm:text-[2.7rem]">
            Free to try.
            <br />
            Cheap to keep.
          </h2>
        </div>
      </Reveal>
      <Reveal delay={0.06}>
        <PlansGrid origin="landing" />
      </Reveal>
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
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-background p-6 sm:p-8">
        <div className="mb-7 flex items-start justify-between gap-6">
          <div>
            <h2 className="text-[19px] font-semibold tracking-tight">{head.title}</h2>
            <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted-foreground">
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
