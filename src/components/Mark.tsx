/**
 * The mark, for sitting beside the wordmark.
 *
 * A lowercase p built from the grid's own tiles: five rounded squares in a
 * 2x3 matrix, checker-shaded like the transparency board behind every image
 * in the product, with the last tile missing — the one you took. Drawn in
 * currentColor so it follows whatever text it stands next to, in either
 * theme, without carrying colours of its own.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 22"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <rect x="0" y="0" width="6" height="6" rx="1.5" />
      <rect x="8" y="0" width="6" height="6" rx="1.5" opacity="0.45" />
      <rect x="0" y="8" width="6" height="6" rx="1.5" opacity="0.45" />
      <rect x="8" y="8" width="6" height="6" rx="1.5" />
      <rect x="0" y="16" width="6" height="6" rx="1.5" />
    </svg>
  );
}
