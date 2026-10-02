// Camera motion tracking and terrain analysis for background videos. Browser only.

export interface CameraMotion {
  /** Accumulated camera offset (px, at analysis scale) per time in seconds. */
  samples: { time: number; dx: number; dy: number }[];
  /** Scale factor from analysis resolution to project pixels. */
  scale: number;
  duration: number;
}

export interface TerrainPoint {
  /** Normalized position (0..1) on the video frame. */
  x: number;
  y: number;
  /** Estimated ground tilt in degrees at this point. */
  tilt: number;
  kind: "high" | "low";
}

const ANALYZE_W = 160;

function loadVideoEl(src: string): Promise<HTMLVideoElement> {
  return new Promise((res, rej) => {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    v.onloadeddata = () => res(v);
    v.onerror = rej;
    v.src = src;
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    v.addEventListener("seeked", () => resolve(), { once: true });
    v.currentTime = Math.min(t, Math.max(0, v.duration - 0.05));
  });
}

function grabGray(v: HTMLVideoElement, w: number, h: number): Uint8Array {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(v, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    g[i] = (d[i * 4]! * 3 + d[i * 4 + 1]! * 4 + d[i * 4 + 2]!) >> 3;
  }
  return g;
}

/** Best integer translation of `cur` relative to `prev` via coarse block matching. */
function matchShift(
  prev: Uint8Array,
  cur: Uint8Array,
  w: number,
  h: number,
): { dx: number; dy: number } {
  const B = 16; // block size
  const R = 10; // search radius
  let best = { dx: 0, dy: 0, err: Infinity };
  const blocks: { x: number; y: number }[] = [];
  for (let y = B; y < h - B; y += B * 2)
    for (let x = B; x < w - B; x += B * 2) blocks.push({ x, y });

  for (let dy = -R; dy <= R; dy += 2) {
    for (let dx = -R; dx <= R; dx += 2) {
      let err = 0;
      for (const b of blocks) {
        for (let j = 0; j < B; j += 4) {
          for (let i = 0; i < B; i += 4) {
            const px = b.x + i;
            const py = b.y + j;
            const qx = px + dx;
            const qy = py + dy;
            if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
            const diff = prev[py * w + px]! - cur[qy * w + qx]!;
            err += diff * diff;
          }
        }
      }
      if (err < best.err) best = { dx, dy, err };
    }
  }
  return { dx: best.dx, dy: best.dy };
}

/** Analyzes the background video and returns accumulated camera motion over time. */
export async function analyzeCameraMotion(
  src: string,
  duration: number,
  onProgress?: (p: number) => void,
): Promise<CameraMotion> {
  const v = await loadVideoEl(src);
  const vidDur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : duration;
  const total = Math.min(duration, vidDur);
  const h = Math.max(2, Math.round((ANALYZE_W * v.videoHeight) / v.videoWidth));
  const step = 1 / 6; // 6 analysis fps is enough for smooth motion
  const samples: CameraMotion["samples"] = [{ time: 0, dx: 0, dy: 0 }];
  let prev: Uint8Array | null = null;
  let accX = 0;
  let accY = 0;

  for (let t = 0; t <= total; t += step) {
    await seek(v, t);
    const g = grabGray(v, ANALYZE_W, h);
    if (prev) {
      const { dx, dy } = matchShift(prev, g, ANALYZE_W, h);
      accX += dx;
      accY += dy;
      samples.push({ time: t, dx: accX, dy: accY });
    }
    prev = g;
    onProgress?.(Math.min(1, t / total));
  }
  return { samples, scale: 1280 / ANALYZE_W, duration: total };
}

/** Interpolated camera offset at a given time (in project pixels). */
export function cameraOffsetAt(m: CameraMotion, time: number): { x: number; y: number } {
  const s = m.samples;
  const first = s[0];
  const last = s[s.length - 1];
  if (!first || !last) return { x: 0, y: 0 };
  if (time <= first.time) return { x: first.dx * m.scale, y: first.dy * m.scale };
  if (time >= last.time) return { x: last.dx * m.scale, y: last.dy * m.scale };
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]!;
    const b = s[i + 1]!;
    if (time >= a.time && time <= b.time) {
      const k = (time - a.time) / (b.time - a.time || 1e-6);
      return {
        x: (a.dx + (b.dx - a.dx) * k) * m.scale,
        y: (a.dy + (b.dy - a.dy) * k) * m.scale,
      };
    }
  }
  return { x: 0, y: 0 };
}

/**
 * Estimates terrain high/low points from the first frame: finds the ground line
 * per column (strongest horizontal edge in the lower half) and reports the
 * highest and lowest ground points with local tilt.
 */
export async function analyzeTerrain(src: string): Promise<TerrainPoint[]> {
  const v = await loadVideoEl(src);
  await seek(v, 0.1);
  const w = ANALYZE_W;
  const h = Math.max(2, Math.round((ANALYZE_W * v.videoHeight) / v.videoWidth));
  const g = grabGray(v, w, h);

  // Ground y per column: strongest dark-to-bright edge in lower 60%.
  const groundY: number[] = [];
  for (let x = 0; x < w; x++) {
    let bestY = Math.round(h * 0.75);
    let bestEdge = 0;
    for (let y = Math.round(h * 0.4); y < h - 2; y++) {
      const edge = Math.abs(g[(y + 1) * w + x]! - g[y * w + x]!);
      if (edge > bestEdge) {
        bestEdge = edge;
        bestY = y;
      }
    }
    groundY.push(bestY);
  }
  // Smooth the ground line.
  const sm = groundY.map((_, x) => {
    let sum = 0;
    let n = 0;
    for (let k = -4; k <= 4; k++) {
      const idx = x + k;
      if (idx >= 0 && idx < w) {
        sum += groundY[idx]!;
        n++;
      }
    }
    return sum / n;
  });

  const points: TerrainPoint[] = [];
  let hi = 0;
  let lo = 0;
  for (let x = 0; x < w; x++) {
    if (sm[x]! < sm[hi]!) hi = x; // smaller y = higher on screen
    if (sm[x]! > sm[lo]!) lo = x;
  }
  const tiltAt = (x: number) => {
    const a = sm[Math.max(0, x - 6)]!;
    const b = sm[Math.min(w - 1, x + 6)]!;
    return (Math.atan2(b - a, 12) * 180) / Math.PI;
  };
  points.push({ x: hi / w, y: sm[hi]! / h, tilt: tiltAt(hi), kind: "high" });
  points.push({ x: lo / w, y: sm[lo]! / h, tilt: tiltAt(lo), kind: "low" });
  // A few extra sample points along the ground line.
  for (const fx of [0.25, 0.5, 0.75]) {
    const x = Math.round(fx * (w - 1));
    points.push({ x: fx, y: sm[x]! / h, tilt: tiltAt(x), kind: "low" });
  }
  return points;
}
