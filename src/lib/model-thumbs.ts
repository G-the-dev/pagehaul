/**
 * Posters for 3D models, captured once from a live render and remembered.
 *
 * A model tile renders the real thing the first time — a WebGL context, a
 * decode, a paint — and captures a frame the moment it settles. Every
 * remount after that is a plain image, which is what lets the virtualised
 * grid scroll past models as cheaply as past photographs. Same deal as the
 * video frame cache: lives for the page, never persisted.
 */

import { preloadModelViewer } from "@/components/ModelPreview";

const posters = new Map<string, string>();

export function cachedModelPoster(id: string): string | undefined {
  return posters.get(id);
}

export function saveModelPoster(id: string, dataUrl: string): void {
  if (dataUrl && dataUrl.length > 200) posters.set(id, dataUrl);
}

/**
 * One model at a time, whatever anyone asks for.
 *
 * A browser allows only a handful of live WebGL contexts, and a grid of
 * twelve models mounting twelve viewers at once had the browser killing the
 * oldest contexts as fast as they opened — one survivor, eleven tiles stuck
 * on a cube forever. Every poster render now goes through this queue: one
 * hidden viewer, one model, capture, tear down, next. Tiles show their
 * loading state until their turn comes, and each finished poster frees its
 * context before the next model spends one.
 */
const pending = new Map<string, Promise<string | null>>();
let chain: Promise<unknown> = Promise.resolve();

export function ensureModelPoster(
  id: string,
  url: string,
): Promise<string | null> {
  const have = posters.get(id);
  if (have) return Promise.resolve(have);
  const running = pending.get(id);
  if (running) return running;

  const job = new Promise<string | null>((resolve) => {
    chain = chain.then(async () => {
      if (posters.has(id)) {
        resolve(posters.get(id)!);
        return;
      }
      const data = await renderOnce(url).catch(() => null);
      if (data) saveModelPoster(id, data);
      resolve(data && data.length > 200 ? data : null);
    });
  });
  pending.set(id, job);
  void job.finally(() => pending.delete(id));
  return job;
}

interface ModelViewerEl extends HTMLElement {
  toDataURL?: (type?: string) => string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Gives every primitive a material, because the renderer demands one.
 *
 * Optimised production glTF often ships with no materials at all — the site
 * assigns its own shaders at runtime — and model-viewer's scene-graph layer
 * crashes on exactly that: "Cannot read properties of undefined (reading
 * 'materials')". A neutral grey is honest for a preview and lets the
 * geometry, which is what the person wants to see, actually appear.
 */
function patchMaterials(g: any): boolean {
  const meshes = g?.meshes;
  if (!Array.isArray(meshes)) return false;
  const need = meshes.some((m: any) =>
    m?.primitives?.some((p: any) => p.material === undefined),
  );
  if (!need) return false;
  if (!Array.isArray(g.materials)) g.materials = [];
  g.materials.push({
    pbrMetallicRoughness: {
      baseColorFactor: [0.72, 0.72, 0.76, 1],
      metallicFactor: 0.15,
      roughnessFactor: 0.55,
    },
  });
  const idx = g.materials.length - 1;
  for (const m of meshes) {
    for (const p of m?.primitives ?? []) {
      if (p.material === undefined) p.material = idx;
    }
  }
  return true;
}

async function fetchModel(url: string): Promise<ArrayBuffer> {
  try {
    const r = await fetch(url, { mode: "cors", credentials: "omit" });
    if (r.ok) return await r.arrayBuffer();
  } catch {
    /* fall through to the relay */
  }
  const r2 = await fetch(`/api/download?url=${encodeURIComponent(url)}`);
  if (!r2.ok) throw new Error("model unreachable");
  return await r2.arrayBuffer();
}

/**
 * Fetches a model and returns a local URL the renderer will accept: CORS
 * handled by the relay when the origin refuses, and material-less files
 * repaired on the way through. GLB is rebuilt chunk by chunk; a .gltf gets
 * its relative buffer and image URIs made absolute first, since a blob URL
 * resolves them nowhere.
 */
export async function prepareModel(url: string): Promise<string> {
  const buf = await fetchModel(url);
  const u8 = new Uint8Array(buf);
  const isGlb =
    u8.length > 20 &&
    u8[0] === 0x67 && u8[1] === 0x6c && u8[2] === 0x54 && u8[3] === 0x46;

  if (isGlb) {
    const dv = new DataView(buf);
    const jsonLen = dv.getUint32(12, true);
    const g = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jsonLen)));
    // A glb can hold no geometry at all — camera paths and animation
    // timelines ship this way. There is nothing to draw; say so at once
    // rather than spending a render slot proving it.
    if (!Array.isArray(g.meshes) || g.meshes.length === 0) {
      throw new Error("no geometry");
    }
    if (patchMaterials(g)) {
      const jsonOut = new TextEncoder().encode(JSON.stringify(g));
      const pad = (4 - (jsonOut.length % 4)) % 4;
      const jsonChunk = new Uint8Array(jsonOut.length + pad).fill(0x20);
      jsonChunk.set(jsonOut);
      const rest = u8.subarray(20 + jsonLen);
      const out = new Uint8Array(12 + 8 + jsonChunk.length + rest.length);
      const odv = new DataView(out.buffer);
      out.set(u8.subarray(0, 12));
      odv.setUint32(8, out.length, true);
      odv.setUint32(12, jsonChunk.length, true);
      odv.setUint32(16, 0x4e4f534a, true); // 'JSON'
      out.set(jsonChunk, 20);
      out.set(rest, 20 + jsonChunk.length);
      return URL.createObjectURL(new Blob([out], { type: "model/gltf-binary" }));
    }
    return URL.createObjectURL(new Blob([u8], { type: "model/gltf-binary" }));
  }

  const g = JSON.parse(new TextDecoder().decode(u8));
  for (const list of [g.buffers, g.images]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item?.uri && !/^(data:|https?:|blob:)/i.test(item.uri)) {
        item.uri = new URL(item.uri, url).toString();
      }
    }
  }
  patchMaterials(g);
  return URL.createObjectURL(
    new Blob([JSON.stringify(g)], { type: "model/gltf+json" }),
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Renders one model in a hidden viewer and captures a frame of it. */
async function renderOnce(url: string): Promise<string | null> {
  await preloadModelViewer();
  const src = await prepareModel(url).catch(() => null);
  if (!src) return null;
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:-10000px;top:0;width:320px;height:320px;opacity:0;pointer-events:none";
    const mv = document.createElement("model-viewer") as ModelViewerEl;
    mv.setAttribute("src", src);
    mv.setAttribute("loading", "eager");
    mv.setAttribute("interaction-prompt", "none");
    mv.setAttribute("shadow-intensity", "0.6");
    mv.style.cssText = "width:100%;height:100%";

    let settled = false;
    let guard: ReturnType<typeof setTimeout> | undefined;
    const done = (v: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      host.remove(); // disconnecting is what releases the WebGL context
      URL.revokeObjectURL(src); // the model is parsed; the bytes can go
      resolve(v);
    };

    mv.addEventListener("load", () => {
      // A beat after load so the first real frame has painted.
      setTimeout(() => {
        try {
          done(mv.toDataURL?.("image/png") ?? null);
        } catch {
          done(null);
        }
      }, 350);
    });
    mv.addEventListener("error", () => done(null));
    // One stubborn model must not dam the whole queue.
    guard = setTimeout(() => done(null), 30_000);

    host.appendChild(mv);
    document.body.appendChild(host);
  });
}
