export type AssetKind =
  | "image"
  | "svg"
  | "video"
  | "audio"
  | "font"
  | "document"
  | "code"
  | "data"
  /** Network calls the page made: XHR, fetch, GraphQL. */
  | "api";

export type Origin = "first-party" | "third-party";

export interface Asset {
  /** Stable id derived from the resolved URL. */
  id: string;
  /** Absolute URL of the resource. */
  url: string;
  kind: AssetKind;
  /** Uppercase extension shown in the tile band, e.g. WEBP. */
  format: string;
  /** Filename without extension, as served. */
  name: string;
  /** Readable label for the tile. Derived when the filename is a hash. */
  displayName: string;
  /** Real family name for fonts, read out of the @font-face rule. */
  fontFamily?: string;
  /** Tracking pixels and empty responses, hidden from the default view. */
  noise?: boolean;
  /** HTTP method, for network calls. */
  method?: string;
  /** HTTP status, for network calls. */
  status?: number;
  /** Raw content-type header, for network calls. */
  contentType?: string;
  /** Short preview of a JSON body, so an API row is readable at a glance. */
  preview?: string;
  /** Bytes, when the origin reported a content-length. */
  bytes?: number;
  /** Intrinsic size when the markup declared it. The client refines this on load. */
  width?: number;
  height?: number;
  /** Smallest known srcset variant — used for the preview so we never pull the original. */
  thumbUrl?: string;
  /** Poster frame for video. */
  poster?: string;
  alt?: string;
  /** Page this asset was discovered on. */
  fromPage: string;
  /** Rough placement: header, hero, main, footer, nav. */
  section?: string;
  origin: Origin;
  /** Groups a srcset family together so duplicates collapse. */
  variantKey?: string;
  /** True for the highest-resolution member of a srcset family. */
  isLargest?: boolean;
  /** How many sizes of this picture exist, counted on the largest of them. */
  variantCount?: number;
  /** The other sizes, largest first, so the preview can offer a choice. */
  variants?: { url: string; label: string; bytes?: number }[];
  /** Formats that can carry an alpha channel — drives the checkerboard preview. */
  transparent?: boolean;
  /** Inline SVG serialised into a data URL rather than a network resource. */
  inline?: boolean;
}

export interface ScanPage {
  url: string;
  title?: string;
  ok: boolean;
  error?: string;
}

/** A colour the page actually paints with, and how often it does so. */
export interface Swatch {
  hex: string;
  count: number;
  /** Where it was seen most: text, background, or border. */
  role: "text" | "background" | "border" | "accent";
}

/** Type actually in use on the page, read from computed styles. */
export interface TypeSpec {
  family: string;
  weights: string[];
  sizes: string[];
}

export interface ScanResult {
  /** Palette extracted from what the page paints, ranked by usage. */
  palette?: Swatch[];
  /** Font families in real use with their weights and sizes. */
  typography?: TypeSpec[];
  /** Design tokens the site declares as CSS custom properties. */
  tokens?: { name: string; value: string }[];
  target: string;
  pages: ScanPage[];
  assets: Asset[];
  /** Wall-clock milliseconds the scan took. */
  ms: number;
  /** Non-fatal problems worth surfacing to the user. */
  notes: string[];
}

export const KIND_LABEL: Record<AssetKind, string> = {
  image: "Images",
  api: "Network",
  svg: "SVG",
  video: "Video",
  audio: "Audio",
  font: "Fonts",
  document: "Documents",
  code: "Code",
  data: "Data",
};

/** Order the filter rail lists kinds in. */
export const KIND_ORDER: AssetKind[] = [
  "image",
  "svg",
  "video",
  "audio",
  "font",
  "document",
  "data",
  "code",
  "api",
];
