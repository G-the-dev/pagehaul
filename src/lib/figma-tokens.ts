import type { Swatch, TypeSpec } from "./types";

/**
 * Builds a design-tokens file Figma can import.
 *
 * Figma has no native "import tokens" — the way tokens reach it is a plugin
 * (Tokens Studio, Variables JSON Import, Design Tokens to Variables) that reads
 * the W3C Design Tokens Community Group (DTCG) JSON format. So that is what this
 * writes: colours become colour variables, the pixel tokens become dimension
 * variables, and each font family/weight/size becomes a typography style.
 *
 * The shape is grouped by `$type` and nested on the token name's dashes, so a
 * declared `--color-pink-500` lands as color → pink → 500 rather than one long
 * flat name — which is how a designer expects the variables to read in Figma.
 */

interface DtcgToken {
  $type: string;
  $value: unknown;
  $description?: string;
}

type DtcgNode = { [key: string]: DtcgNode | DtcgToken };

const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB = /^rgba?\(/i;
const DIMENSION = /^-?\d*\.?\d+(px|rem|em)$/i;

/** Sets a token at a slash/dash path, creating groups as it goes. */
function place(root: DtcgNode, path: string[], token: DtcgToken): void {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const existing = node[key];
    if (!existing || "$value" in existing) node[key] = {};
    node = node[key] as DtcgNode;
  }
  node[path[path.length - 1]] = token;
}

/** A CSS custom property name into a clean token path: --color-pink-500 → color/pink/500. */
function tokenPath(name: string): string[] {
  return name
    .replace(/^--/, "")
    .split("-")
    .filter(Boolean);
}

/** A font family into a safe token key. */
function familyKey(family: string): string {
  return (
    family
      .replace(/['"]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "font"
  );
}

/** Maps a named CSS weight, or a number, to the numeric weight Figma wants. */
function numericWeight(w: string): number {
  const named: Record<string, number> = {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    regular: 400,
    medium: 500,
    semibold: 600,
    demibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  };
  const n = Number(w);
  if (Number.isFinite(n)) return n;
  return named[w.toLowerCase().replace(/\s+/g, "")] ?? 400;
}

export function buildFigmaTokens(input: {
  host: string;
  palette?: Swatch[];
  typography?: TypeSpec[];
  tokens?: { name: string; value: string }[];
}): string {
  const root: DtcgNode = {
    $description: `Design tokens extracted from ${input.host} with pagehaul`,
  } as unknown as DtcgNode;

  const color: DtcgNode = {};
  const dimension: DtcgNode = {};

  // The palette the page actually paints with, ranked. Named by role so the
  // variables read as text-1, background-2 rather than a bare hex.
  const perRole: Record<string, number> = {};
  for (const s of input.palette ?? []) {
    const n = (perRole[s.role] = (perRole[s.role] ?? 0) + 1);
    place(color, ["palette", `${s.role}-${n}`], {
      $type: "color",
      $value: s.hex,
      $description: `used ${s.count} time${s.count === 1 ? "" : "s"}`,
    });
  }

  // The tokens the site declared itself — the good, named ones. Typed by value.
  for (const t of input.tokens ?? []) {
    const value = t.value.trim();
    const path = tokenPath(t.name);
    if (!path.length) continue;
    if (HEX.test(value) || RGB.test(value)) {
      place(color, path, { $type: "color", $value: value });
    } else if (DIMENSION.test(value)) {
      place(dimension, path, { $type: "dimension", $value: value });
    }
    // Anything else (shadows, gradients, easings) has no clean Figma variable
    // type, so it is left out rather than imported as something wrong.
  }

  const typography: DtcgNode = {};
  const fontFamily: DtcgNode = {};
  for (const t of input.typography ?? []) {
    const key = familyKey(t.family);
    fontFamily[key] = { $type: "fontFamily", $value: t.family.replace(/['"]/g, "") };
    // One text style per weight×size, which is how Figma text styles are built.
    const sizes = t.sizes.length ? t.sizes : ["16px"];
    const weights = t.weights.length ? t.weights : ["400"];
    for (const w of weights) {
      for (const size of sizes) {
        const wn = numericWeight(w);
        const sizeLabel = size.replace(/px$/, "");
        place(typography, [key, `${wn}-${sizeLabel}`], {
          $type: "typography",
          $value: {
            fontFamily: t.family.replace(/['"]/g, ""),
            fontWeight: wn,
            fontSize: size.endsWith("px") ? size : `${size}px`,
          },
        });
      }
    }
  }

  const out = root as unknown as Record<string, unknown>;
  if (Object.keys(color).length) out.color = color;
  if (Object.keys(dimension).length) out.dimension = dimension;
  if (Object.keys(fontFamily).length) out.fontFamily = fontFamily;
  if (Object.keys(typography).length) out.typography = typography;

  return JSON.stringify(out, null, 2);
}
