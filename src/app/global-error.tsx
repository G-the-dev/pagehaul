"use client";

import { useEffect } from "react";

/**
 * The last resort, for a failure in the root layout itself.
 *
 * When this fires the normal layout never rendered, so there is no theme class,
 * no font variable and no stylesheet to rely on. It has to supply its own html
 * and body tags, and every colour here is written literally rather than read
 * from a token, because the tokens live in a stylesheet that may not have
 * loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.6rem",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              margin: "0 0 1rem",
            }}
          >
            The site failed to load.
          </h1>
          <p
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.6,
              color: "#a1a1a1",
              margin: "0 0 1.75rem",
            }}
          >
            Something went wrong before the page could start. Reloading usually
            fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#fafafa",
              color: "#171717",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: "2.5rem",
                fontSize: "0.7rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "#737373",
              }}
            >
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
