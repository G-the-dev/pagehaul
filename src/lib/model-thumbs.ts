/**
 * Posters for 3D models, captured once from a live render and remembered.
 *
 * A model tile renders the real thing the first time — a WebGL context, a
 * decode, a paint — and captures a frame the moment it settles. Every
 * remount after that is a plain image, which is what lets the virtualised
 * grid scroll past models as cheaply as past photographs. Same deal as the
 * video frame cache: lives for the page, never persisted.
 */

const posters = new Map<string, string>();

export function cachedModelPoster(id: string): string | undefined {
  return posters.get(id);
}

export function saveModelPoster(id: string, dataUrl: string): void {
  if (dataUrl && dataUrl.length > 200) posters.set(id, dataUrl);
}
