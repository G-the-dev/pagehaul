import { ImageResponse } from "next/og";

/**
 * The home screen icon for iOS.
 *
 * iOS will not read an SVG here and cannot adapt to a theme, so this is
 * generated as a PNG at build time and fixed to the dark version. It also
 * fills the whole square rather than using a rounded rect, because iOS applies
 * its own corner radius and a second one inside it looks wrong.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="104"
          height="104"
          viewBox="0 0 32 32"
          fill="none"
          stroke="#fafafa"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 7v10" />
          <path d="M11.5 13.5 16 18l4.5-4.5" />
          <path d="M8 24h16" />
        </svg>
      </div>
    ),
    size,
  );
}
