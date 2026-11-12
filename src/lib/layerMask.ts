export interface LayerMask {
  shape: "rect" | "ellipse";
  /** Mask size as % of the layer box. */
  size: number;
  /** Soft edge in px. */
  feather: number;
  invert: boolean;
}

export const DEFAULT_MASK: LayerMask = { shape: "ellipse", size: 80, feather: 12, invert: false };

/** Builds the mask alpha canvas used by both the stage (as CSS mask) and video export. */
export function makeMaskCanvas(mask: LayerMask, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const f = Math.max(0, mask.feather);
  const mw = Math.max(1, (c.width * mask.size) / 100 - f * 2);
  const mh = Math.max(1, (c.height * mask.size) / 100 - f * 2);
  if (mask.invert) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "destination-out";
  }
  ctx.filter = f ? `blur(${f / 2}px)` : "none";
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  if (mask.shape === "ellipse") ctx.ellipse(c.width / 2, c.height / 2, mw / 2, mh / 2, 0, 0, Math.PI * 2);
  else ctx.rect((c.width - mw) / 2, (c.height - mh) / 2, mw, mh);
  ctx.fill();
  return c;
}

const cache = new Map<string, string>();
export function maskDataUrl(mask: LayerMask, w: number, h: number) {
  const key = `${mask.shape}|${mask.size}|${mask.feather}|${mask.invert}|${Math.round(w)}|${Math.round(h)}`;
  let url = cache.get(key);
  if (!url) {
    url = makeMaskCanvas(mask, w, h).toDataURL("image/png");
    if (cache.size > 200) cache.clear();
    cache.set(key, url);
  }
  return url;
}

/** Keeps only the masked part of a canvas (in place). */
export function applyMask(target: HTMLCanvasElement, mask: LayerMask) {
  const ctx = target.getContext("2d");
  if (!ctx) return target;
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(makeMaskCanvas(mask, target.width, target.height), 0, 0);
  ctx.restore();
  return target;
}
