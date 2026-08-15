"use client";

import { useState } from "react";
import { SITE } from "@/lib/site";

/**
 * A bug report or a piece of feedback, sent without leaving the page.
 *
 * The kind is asked first because it changes what we need from them: a bug is
 * useless without the address it happened on, feedback rarely needs one.
 */

// Two options, because a third called "Something else" only makes people stop
// and wonder which one they are. Anything that is not a bug is feedback.
const KINDS = [
  { id: "bug", label: "Report a bug" },
  { id: "feedback", label: "Give feedback" },
] as const;

type Kind = (typeof KINDS)[number]["id"];
type State = "idle" | "sending" | "sent" | "error";

export function FeedbackForm() {
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setError(null);

    const body = message.trim();
    if (body.length < 10) {
      setError("Please say a little more so we can act on it.");
      setState("error");
      return;
    }
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email.trim())) {
      setError("That email address does not look right.");
      setState("error");
      return;
    }

    setState("sending");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, message, email, url, website }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "That did not send.");
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setError(`That did not send. Please email ${SITE.contactEmail} instead.`);
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full border border-accent-line bg-accent-soft">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        </div>
        <p className="text-[16px] font-semibold">Sent. Thank you.</p>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          {email
            ? "If it needs a reply, it will come to the address you gave."
            : "You did not leave an address, so this one is one way. That is fine."}
        </p>
        <button
          type="button"
          onClick={() => {
            setState("idle");
            setMessage("");
            setUrl("");
          }}
          className="mt-6 text-[13.5px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Send another
        </button>
      </div>
    );
  }

  const label =
    kind === "bug"
      ? "What happened, and what did you expect instead?"
      : "What would make this better?";

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-xl border border-border bg-surface p-6 sm:p-7"
    >
      <fieldset className="mb-6">
        <legend className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          What is this about
        </legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const active = kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Only asked for a bug, where it is the single most useful field. */}
      {kind === "bug" && (
        <label className="mb-5 block">
          <span className="mb-2 block text-[13.5px] font-medium">
            The page it failed on
          </span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="stripe.com"
            className="h-11 w-full rounded-lg border border-border bg-background px-3.5 text-[14.5px] outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"
          />
          <span className="mt-1.5 block text-[12.5px] text-muted-foreground">
            Most failures are specific to one site, so this is the thing that
            usually solves it.
          </span>
        </label>
      )}

      <label className="mb-5 block">
        <span className="mb-2 block text-[13.5px] font-medium">{label}</span>
        <textarea
          value={message}
          aria-invalid={!!error}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={4000}
          className="w-full resize-y rounded-lg border border-border bg-background px-3.5 py-3 text-[14.5px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"
          placeholder={
            kind === "bug"
              ? "It found 3 files on a page with dozens of images."
              : "It would help if…"
          }
        />
      </label>

      <label className="mb-6 block">
        <span className="mb-2 block text-[13.5px] font-medium">
          Your email{" "}
          <span className="font-normal text-muted-foreground">
            optional, only used to reply
          </span>
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 w-full rounded-lg border border-border bg-background px-3.5 text-[14.5px] outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"
        />
      </label>

      {/* Hidden from people, tempting to bots. Never focusable. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-[13px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-6 text-[14px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {state === "sending" ? "Sending" : "Send"}
      </button>
    </form>
  );
}
