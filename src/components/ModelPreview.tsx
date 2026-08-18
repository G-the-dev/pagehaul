"use client";

import { createElement, useEffect, useRef, useState } from "react";

/**
 * A live render of a 3D file, so a model can be judged the way a picture is.
 *
 * Uses <model-viewer>, the standard glTF renderer for the web, fetched as
 * its own chunk the first time a model is actually on screen — a visitor
 * who never meets a 3D asset never downloads a 3D engine. The file itself
 * is fetched from its origin; if that origin refuses a cross-origin read,
 * the same relay that rescues downloads serves the preview.
 *
 * glb and gltf render. The formats no browser engine draws — fbx, stl,
 * usdz and friends — report failure through onFail, and the caller keeps
 * its placeholder.
 */

let loader: Promise<unknown> | null = null;
function ensureModelViewer(): Promise<unknown> {
  loader ??= import("@google/model-viewer");
  return loader;
}

interface ModelViewerEl extends HTMLElement {
  toDataURL?: (type?: string, quality?: number) => string;
}

export function ModelPreview({
  url,
  interactive = false,
  onPoster,
  onFail,
}: {
  url: string;
  /** Camera controls for the dialog; the tile just turns slowly. */
  interactive?: boolean;
  /** Called once with a captured frame, for the tile cache. */
  onPoster?: (dataUrl: string) => void;
  /** The file would not load or render; show something else. */
  onFail?: () => void;
}) {
  const ref = useRef<ModelViewerEl>(null);
  const [ready, setReady] = useState(false);
  const [src, setSrc] = useState(url);
  const triedRelay = useRef(false);

  useEffect(() => {
    let alive = true;
    ensureModelViewer().then(
      () => alive && setReady(true),
      () => alive && onFail?.(),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;

    let captureTimer: ReturnType<typeof setTimeout> | undefined;
    const onLoad = () => {
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
    const onError = () => {
      if (!triedRelay.current) {
        // The origin refused the browser's read. Our relay is not bound by
        // CORS, and the preview arrives from our own origin instead.
        triedRelay.current = true;
        setSrc(`/api/download?url=${encodeURIComponent(url)}`);
      } else {
        onFail?.();
      }
    };
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => {
      clearTimeout(captureTimer);
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
  }, [ready, url, onPoster, onFail]);

  if (!ready) return null;

  return createElement("model-viewer", {
    ref,
    src,
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
