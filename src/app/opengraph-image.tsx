import { ImageResponse } from "next/og";

/**
 * The card shown when a pagehaul link lands in Slack, X, LinkedIn or a chat.
 *
 * The one brand surface that renders on other people's platforms, so it
 * carries the whole identity: the tile mark, the name, and the one-line
 * promise. Dark always — link cards sit on every background, and the dark
 * tile holds together on all of them.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "pagehaul — every asset on any page, one click away";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 42,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
          <svg width="84" height="132" viewBox="0 0 14 22" fill="#fafafa">
            <rect x="0" y="0" width="6" height="6" rx="1.5" />
            <rect x="8" y="0" width="6" height="6" rx="1.5" opacity="0.5" />
            <rect x="0" y="8" width="6" height="6" rx="1.5" opacity="0.5" />
            <rect x="8" y="8" width="6" height="6" rx="1.5" />
            <rect x="0" y="16" width="6" height="6" rx="1.5" />
          </svg>
          <div
            style={{
              color: "#fafafa",
              fontSize: 118,
              fontWeight: 600,
              letterSpacing: "-0.04em",
            }}
          >
            pagehaul
          </div>
        </div>
        <div
          style={{
            color: "#a1a1aa",
            fontSize: 34,
            letterSpacing: "-0.01em",
          }}
        >
          Every image, icon, video and font on any page. One click away.
        </div>
      </div>
    ),
    size,
  );
}
