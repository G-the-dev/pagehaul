export type AssetKind =
  | "image"
  | "svg"
  | "video"
  | "audio"
  | "font"
  | "document"
  | "code"
  | "data";

export type Origin = "first-party" | "third-party";

export interface Asset {
  /** Stable id derived from the resolved URL. */
  id: string;
  /** Absolute URL of the resource. */
  url: string;
  kind: AssetKind;
  /** Uppercase extension shown in the tile band, e.g. WEBP. */
  format: string;
  /** Filename without extension. */
  name: string;
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

export interface ScanResult {
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
];
