/**
 * The mark, for sitting beside the wordmark.
 *
 * A lowercase p built from the grid's own tiles: five rounded squares in a
 * 2x3 matrix, checker-shaded like the transparency board behind every image
 * in the product, with the last tile missing — the one you took. Drawn in
 * currentColor so it follows whatever text it stands next to, in either
 * theme, without carrying colours of its own.
 *
 * The box is square and the glyph is inset from every edge, deliberately.
 * The tiles used to sit flush against the viewBox, and any renderer that
 * rounds a fractional box shaved whichever edge lost the toss — the bottom
 * row at one zoom level, the right column at another. Margin absorbs the
 * rounding, and a square box leaves no aspect arithmetic to get wrong.
 */
export function Mark({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className="shrink-0"
    >
      <rect x="5" y="1" width="6" height="6" rx="1.5" />
      <rect x="13" y="1" width="6" height="6" rx="1.5" opacity="0.45" />
      <rect x="5" y="9" width="6" height="6" rx="1.5" opacity="0.45" />
      <rect x="13" y="9" width="6" height="6" rx="1.5" />
      <rect x="5" y="17" width="6" height="6" rx="1.5" />
    </svg>
  );
}
