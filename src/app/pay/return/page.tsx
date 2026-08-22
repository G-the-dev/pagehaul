"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { storeLicense } from "@/lib/plan";
import { track } from "@/lib/analytics";

/**
 * Where Dodo's checkout sends the buyer home. The id in the query is
 * handed to the server for verification against Dodo's API; a confirmed
 * purchase installs the unlock token and walks back to a fresh page in
 * the new plan. Nothing here trusts the query string beyond using it as
 * a lookup key.
 */

function ReturnInner() {
  const params = useSearchParams();
  const [state, setState] = useState<"checking" | "done" | "failed">("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const paymentId = params.get("payment_id");
    const subscriptionId = params.get("subscription_id");
    if (!paymentId && !subscriptionId) {
      setState("failed");
      setMessage("This page only makes sense straight after a payment.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/dodo/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            payment_id: paymentId ?? undefined,
            subscription_id: subscriptionId ?? undefined,
          }),
        });
        const data = (await res.json()) as {
          token?: string;
          plan?: string;
          error?: string;
        };
        if (!res.ok || !data.token) {
          setState("failed");
          setMessage(data.error ?? "The payment could not be confirmed.");
          return;
        }
        storeLicense(data.token);
        track("purchase", { plan: data.plan, origin: "dodo" });
        setState("done");
        window.setTimeout(() => {
          window.location.replace("/");
        }, 2500);
      } catch {
        setState("failed");
        setMessage("The payment could not be confirmed. Try reloading this page.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="grid min-h-[100svh] place-items-center bg-background px-6 text-center">
      {state === "checking" && (
        <div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <p className="mt-5 text-[15px] font-medium">Confirming your payment</p>
          <p className="mt-1 text-[13px] text-muted-foreground">A few seconds.</p>
        </div>
      )}
      {state === "done" && (
        <div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_0_0_6px_rgb(16_185_129/0.15)]">
            <Check className="h-7 w-7" strokeWidth={3} aria-hidden />
          </div>
          <p className="mt-5 text-[17px] font-semibold tracking-tight">
            Payment confirmed
          </p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Everything is unlocked. Taking you back.
          </p>
        </div>
      )}
      {state === "failed" && (
        <div>
          <p className="text-[16px] font-semibold tracking-tight">
            Nothing confirmed yet
          </p>
          <p className="mx-auto mt-1.5 max-w-[36ch] text-[13.5px] leading-relaxed text-muted-foreground">
            {message}
          </p>
          <a
            href="/"
            className="mt-5 inline-block rounded-full border border-border px-6 py-2.5 text-[13.5px] font-semibold"
          >
            Back to pagehaul
          </a>
        </div>
      )}
    </main>
  );
}

export default function PayReturnPage() {
  return (
    <Suspense fallback={null}>
      <ReturnInner />
    </Suspense>
  );
}
