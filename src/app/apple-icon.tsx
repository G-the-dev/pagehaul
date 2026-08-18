import { ImageResponse } from "next/og";

/**
 * The home screen icon for iOS.
 *
 * iOS will not read an SVG here and cannot adapt to a theme, so this is
 * generated as a PNG at build time and fixed to the dark version. It also
 * fills the whole square rather than using a rounded rect, because iOS applies
 * its own corner radius and a second one inside it looks wrong.
 *
 * The mark matches icon.svg: a lowercase p built from grid tiles,
 * checker-shaded, with the last tile missing — the one you took.
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
        <svg width="70" height="110" viewBox="0 0 14 22" fill="#fafafa">
          <rect x="0" y="0" width="6" height="6" rx="1.5" />
          <rect x="8" y="0" width="6" height="6" rx="1.5" opacity="0.5" />
          <rect x="0" y="8" width="6" height="6" rx="1.5" opacity="0.5" />
          <rect x="8" y="8" width="6" height="6" rx="1.5" />
          <rect x="0" y="16" width="6" height="6" rx="1.5" />
        </svg>
      </div>
    ),
    size,
  );
}
