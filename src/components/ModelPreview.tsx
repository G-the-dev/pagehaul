"use client";

import { createElement, useEffect, useRef, useState } from "react";

/**
 * A live render of a 3D file, so a model can be judged the way a picture is.
 *
 * Uses <model-viewer>, the standard glTF renderer for the web, fetched as
 * its own chunk the first time a model is actually on screen — a visitor
 * who never meets a 3D asset never downloads a 3D engine. Callers that know
 * a model is coming can warm the chunk early with preloadModelViewer, which
 * is most of what makes the first open feel quick. The file itself is
 * fetched from its origin; if that origin refuses a cross-origin read, the
 * same relay that rescues downloads serves the preview.
 *
 * glb and gltf render. The formats no browser engine draws — fbx, stl,
 * usdz and friends — report failure through onFail, and the caller keeps
 * its placeholder.
 */

let loader: Promise<unknown> | null = null;
export function preloadModelViewer(): Promise<unknown> {
  loader ??= import("@google/model-viewer").then((mod) => {
    // Draco-compressed models — most production glTF is — need a decoder,
    // and model-viewer fetches it from Google's CDN by default: one more
    // external dependency to be blocked, filtered or slow. The decoder
    // ships from our own origin instead, always.
    const MV = (
      mod as { ModelViewerElement?: { dracoDecoderLocation?: string } }
    ).ModelViewerElement;
    if (MV) MV.dracoDecoderLocation = "/draco/";
    return mod;
  });
  return loader;
}

interface ModelViewerEl extends HTMLElement {
  toDataURL?: (type?: string, quality?: number) => string;
}

export function ModelPreview({
  url,
  poster,
  interactive = false,
  onPoster,
  onLoaded,
  onProgress,
  onFail,
}: {
  url: string;
  /** A frame captured earlier — shown instantly while the real thing loads. */
  poster?: string;
  /** Camera controls for the dialog; the tile just turns slowly. */
  interactive?: boolean;
  /** Called once with a captured frame, for the tile cache. */
  onPoster?: (dataUrl: string) => void;
  /** The model is on screen and turning. */
  onLoaded?: () => void;
  /** Download progress, 0..1 — enough to show the wait is moving. */
  onProgress?: (fraction: number) => void;
  /** The file would not load or render; show something else. */
  onFail?: () => void;
}) {
  const ref = useRef<ModelViewerEl>(null);
  const [ready, setReady] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // The file arrives as a local blob: fetched here (through the relay when
    // the origin refuses CORS) and repaired on the way — material-less
    // production glTF crashes the renderer otherwise.
    Promise.all([
      preloadModelViewer(),
      import("@/lib/model-thumbs").then((m) => m.prepareModel(url)),
    ]).then(
      ([, prepared]) => {
        if (!alive) {
          URL.revokeObjectURL(prepared);
          return;
        }
        setSrc(prepared);
        setReady(true);
      },
      () => alive && onFail?.(),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // The blob outlives the element only until the element goes.
  useEffect(() => {
    return () => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    };
  }, [src]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;

    let captureTimer: ReturnType<typeof setTimeout> | undefined;
    const onLoad = () => {
      onLoaded?.();
      // A beat after load, so the first real frame has painted before the
      // capture reads it back.
      captureTimer = setTimeout(() => {
        try {
          const data = el.toDataURL?.("image/png");
          if (data) onPoster?.(data);
        } catch {
          /* a refused readback only costs the cache, not the render */
        }
      }, 400);
    };
    const onProg = (e: Event) => {
      const detail = (e as CustomEvent<{ totalProgress?: number }>).detail;
      if (typeof detail?.totalProgress === "number") {
        onProgress?.(detail.totalProgress);
      }
    };
    const onError = () => onFail?.();
    el.addEventListener("load", onLoad);
    el.addEventListener("progress", onProg);
    el.addEventListener("error", onError);
    return () => {
      clearTimeout(captureTimer);
      el.removeEventListener("load", onLoad);
      el.removeEventListener("progress", onProg);
      el.removeEventListener("error", onError);
    };
  }, [ready, url, onPoster, onLoaded, onProgress, onFail]);

  if (!ready || !src) return null;

  return createElement("model-viewer", {
    ref,
    src,
    ...(poster ? { poster } : {}),
    loading: "eager",
    "auto-rotate": "",
    "interaction-prompt": "none",
    "shadow-intensity": "0.6",
    ...(interactive ? { "camera-controls": "" } : {}),
    style: { width: "100%", height: "100%" },
  });
}

/** True when a browser engine can actually draw this model format. */
export function modelRenderable(url: string): boolean {
  return /\.(glb|gltf)(\?|$)/i.test(url);
}

/** The stand-in while an engine or a model is still arriving: a cube with a
 *  pulse, so the wait reads as "preview coming" rather than "nothing here". */
export function ModelLoading({ label }: { label?: string }) {
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="flex animate-pulse flex-col items-center gap-2">
        <svg
          viewBox="0 0 48 48"
          className="h-12 w-12 text-fg-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        >
          <path d="M24 6 40 15v18L24 42 8 33V15L24 6Z" />
          <path d="M8 15l16 9 16-9M24 24v18" />
        </svg>
        {label && <span className="label-mono text-[10px]">{label}</span>}
      </div>
    </div>
  );
}
