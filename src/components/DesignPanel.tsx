"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Swatch, TypeSpec } from "@/lib/types";
import { Tooltip } from "./ui/Tooltip";

interface Props {
  palette?: Swatch[];
  typography?: TypeSpec[];
  tokens?: { name: string; value: string }[];
}

function CopyChip({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      aria-label={`Copy ${value}`}
    >
      {label ?? value}
      {done ? (
        <Check className="h-3 w-3 text-accent" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

/**
 * The design read of a page: what it paints with, what it sets type in, and any
 * tokens it declares. All of it comes from computed styles, so it reflects what
 * the page actually renders rather than what its stylesheet claims.
 */
export function DesignPanel({ palette, typography, tokens }: Props) {
  /** Which swatch was last copied, so only that one confirms. */
  const [copied, setCopied] = useState<string | null>(null);

  function copyHex(hex: string) {
    navigator.clipboard?.writeText(hex).then(
      () => {
        setCopied(hex);
        setTimeout(() => setCopied((c) => (c === hex ? null : c)), 1400);
      },
      () => {
        /* Clipboard can be refused; the value is still readable on the card. */
      },
    );
  }

  const hasAny =
    (palette?.length ?? 0) > 0 ||
    (typography?.length ?? 0) > 0 ||
    (tokens?.length ?? 0) > 0;

  if (!hasAny) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Run a deep scan to read this page&rsquo;s colours and type.
        </p>
      </div>
    );
  }

  const cssVars = (palette ?? [])
    .slice(0, 12)
    .map((s, i) => `  --color-${i + 1}: ${s.hex};`)
    .join("\n");

  return (
    <div className="space-y-10">
      {palette && palette.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold">Palette</h3>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Ranked by how often the page paints with each colour.
              </p>
            </div>
            <CopyChip
              value={`:root {\n${cssVars}\n}`}
              label="Copy as CSS"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 lg:grid-cols-9">
            {palette.map((s) => {
              const justCopied = copied === s.hex;
              return (
                <Tooltip key={s.hex} label={`${s.hex} · ${s.count}× · ${s.role}`}>
                <button
                  type="button"
                  onClick={() => copyHex(s.hex)}
                  aria-label={`Copy ${s.hex}`}
                  className="group overflow-hidden rounded-lg border border-border text-left transition-transform hover:scale-[1.04]"
                >
                  {/* The colour itself carries the confirmation: a click puts a
                      tick on the swatch you clicked, so there is no doubt which
                      one is now on the clipboard. */}
                  <span
                    className="relative block h-14 w-full"
                    style={{ backgroundColor: s.hex }}
                  >
                    <span
                      className={`absolute inset-0 grid place-items-center bg-black/45 transition-opacity duration-150 ${
                        justCopied ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    </span>
                    <span
                      className={`absolute inset-0 grid place-items-center transition-opacity duration-150 ${
                        justCopied ? "opacity-0" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <span className="rounded-md bg-black/55 p-1.5">
                        <Copy className="h-3.5 w-3.5 text-white" />
                      </span>
                    </span>
                  </span>
                  <span className="block px-1.5 py-1.5">
                    <span className="block font-mono text-[10px] uppercase text-foreground">
                      {justCopied ? "copied" : s.hex}
                    </span>
                    <span className="block font-mono text-[9px] text-muted-foreground">
                      {s.role}
                    </span>
                  </span>
                </button>
                </Tooltip>
              );
            })}
          </div>
        </section>
      )}

      {typography && typography.length > 0 && (
        <section>
          <h3 className="mb-4 text-[15px] font-semibold">Typography</h3>
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
            {typography.map((t) => (
              <div key={t.family} className="bg-surface p-5">
                <div
                  className="mb-3 text-3xl leading-none"
                  style={{ fontFamily: `"${t.family}", sans-serif` }}
                >
                  Ag
                </div>
                <div className="text-[14px] font-medium">{t.family}</div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                  <span>weights {t.weights.join(", ")}</span>
                  <span>sizes {t.sizes.slice(0, 4).join(", ")}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tokens && tokens.length > 0 && (
        <section>
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold">Declared tokens</h3>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              CSS custom properties the site defines. This is their design system,
              verbatim.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="max-h-[320px] overflow-y-auto">
              {tokens.map((t, i) => (
                <div
                  key={t.name}
                  className={`flex items-center gap-4 px-4 py-2 font-mono text-[11.5px] ${
                    i % 2 ? "bg-surface-2/40" : "bg-surface"
                  }`}
                >
                  <span className="w-[45%] shrink-0 truncate text-accent">{t.name}</span>
                  <span className="flex items-center gap-2 truncate text-muted-foreground">
                    {/^#|^rgb|^oklch|^hsl/.test(t.value) && (
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm border border-border"
                        style={{ background: t.value }}
                      />
                    )}
                    {t.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
