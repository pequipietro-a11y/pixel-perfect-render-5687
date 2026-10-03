// Core animation model: layers, keyframes, interpolation.

export type PropKey =
  | "x"
  | "y"
  | "rotation"
  | "scaleX"
  | "scaleY"
  | "opacity"
  | "blur"
  | "glow"
  | "shadow"
  | "rotX"
  | "rotY"
  | "rotZ";

export const PROP_KEYS: PropKey[] = [
  "x",
  "y",
  "rotation",
  "scaleX",
  "scaleY",
  "opacity",
  "blur",
  "glow",
  "shadow",
  "rotX",
  "rotY",
  "rotZ",
];

export const PROP_LABELS: Record<PropKey, string> = {
  x: "Posição X",
  y: "Posição Y",
  rotation: "Rotação",
  scaleX: "Escala X",
  scaleY: "Escala Y",
  opacity: "Opacidade",
  blur: "Desfoque",
  glow: "Brilho",
  shadow: "Sombra",
  rotX: "Rotação 3D X",
  rotY: "Rotação 3D Y",
  rotZ: "Rotação 3D Z",
};

export const PROP_UNITS: Record<PropKey, string> = {
  x: "px",
  y: "px",
  rotation: "°",
  scaleX: "%",
  scaleY: "%",
  opacity: "%",
  blur: "px",
  glow: "px",
  shadow: "px",
  rotX: "°",
  rotY: "°",
  rotZ: "°",
};

export const PROP_STEP: Record<PropKey, number> = {
  x: 1,
  y: 1,
  rotation: 1,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  blur: 1,
  glow: 1,
  shadow: 1,
  rotX: 1,
  rotY: 1,
  rotZ: 1,
};

export type EasingName =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easyEase"
  | "back"
  | "hold";

export const EASINGS: Record<
  EasingName,
  { label: string; bezier: [number, number, number, number] }
> = {
  linear: { label: "Linear", bezier: [0, 0, 1, 1] },
  easyEase: { label: "Easy Ease", bezier: [0.33, 0, 0.33, 1] },
  easeIn: { label: "Ease In", bezier: [0.42, 0, 1, 1] },
  easeOut: { label: "Ease Out", bezier: [0, 0, 0.58, 1] },
  easeInOut: { label: "Ease In/Out", bezier: [0.65, 0, 0.35, 1] },
  back: { label: "Elástico (Back)", bezier: [0.68, -0.55, 0.27, 1.55] },
  hold: { label: "Segurar (Hold)", bezier: [1, 0, 1, 0] },
};

export interface Keyframe {
  id: string;
  time: number; // seconds
  value: number;
  easing: EasingName; // easing towards the NEXT keyframe
}

export type LayerKind = "rect" | "ellipse" | "text" | "image" | "video" | "model3d";

export type BlendMode = "normal" | "multiply" | "screen" | "overlay";

export interface LayerEffects {
  blur: number;
  glow: number;
  shadow: number;
}

export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  color: string;
  text?: string | undefined;
  fontSize?: number | undefined;
  src?: string | undefined;
  modelFormat?: ("glb" | "gltf" | "obj") | undefined;
  rotX?: number | undefined;
  rotY?: number | undefined;
  rotZ?: number | undefined;
  /** Layer is pinned to the background video's tracked camera motion. */
  followCamera?: boolean | undefined;
  /** Approximate camera yaw/pitch from tracked image motion. */
  cameraAngle?: boolean | undefined;
  /** Text layer rendered as extruded 3D letters. */
  text3d?: boolean | undefined;
  /** Extrusion depth for 3D text (px). */
  depth?: number | undefined;
  width: number;
  height: number;
  radius: number;
  blend: BlendMode;
  visible: boolean;
  effects: LayerEffects;
  base: Record<PropKey, number>;
  tracks: Record<PropKey, Keyframe[]>;
}

export const DEFAULT_BASE: Record<PropKey, number> = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 100,
  scaleY: 100,
  opacity: 100,
  blur: 0,
  glow: 0,
  shadow: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
};

export function emptyTracks(): Record<PropKey, Keyframe[]> {
  return {
    x: [],
    y: [],
    rotation: [],
    scaleX: [],
    scaleY: [],
    opacity: [],
    blur: [],
    glow: [],
    shadow: [],
    rotX: [],
    rotY: [],
    rotZ: [],
  };
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Solve y for a given x on a cubic-bezier curve (Newton + bisection). */
export function cubicBezier(
  [x1, y1, x2, y2]: [number, number, number, number],
  t: number,
): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleDX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;

  let u = t;
  for (let i = 0; i < 8; i++) {
    const x = sampleX(u) - t;
    if (Math.abs(x) < 1e-6) return sampleY(u);
    const d = sampleDX(u);
    if (Math.abs(d) < 1e-6) break;
    u -= x / d;
  }

  let lo = 0;
  let hi = 1;
  u = t;
  for (let i = 0; i < 24; i++) {
    const x = sampleX(u);
    if (Math.abs(x - t) < 1e-6) break;
    if (x > t) hi = u;
    else lo = u;
    u = (lo + hi) / 2;
  }
  return sampleY(u);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Value of a property track at a given time. */
export function sampleTrack(
  keys: Keyframe[],
  time: number,
  fallback: number,
): number {
  const sorted = [...keys].sort((a, b) => a.time - b.time);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return fallback;
  if (time <= first.time) return first.value;
  if (time >= last.time) return last.value;

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (!a || !b) continue;
    if (time >= a.time && time <= b.time) {
      if (a.easing === "hold") return a.value;
      const span = b.time - a.time || 1e-6;
      const raw = (time - a.time) / span;
      const eased = cubicBezier(EASINGS[a.easing].bezier, raw);
      return lerp(a.value, b.value, eased);
    }
  }
  return last.value;
}

export function sampleLayer(layer: Layer, time: number) {
  const out = {} as Record<PropKey, number>;
  for (const key of PROP_KEYS) {
    const legacyFallback =
      key === "blur" || key === "glow" || key === "shadow"
        ? layer.effects[key]
        : key === "rotX" || key === "rotY" || key === "rotZ"
          ? (layer[key] ?? DEFAULT_BASE[key])
          : DEFAULT_BASE[key];
    out[key] = sampleTrack(
      layer.tracks[key] ?? [],
      time,
      layer.base[key] ?? legacyFallback,
    );
  }
  return out;
}

export function formatTime(t: number, fps: number) {
  const total = Math.max(0, t);
  const s = Math.floor(total);
  const f = Math.round((total - s) * fps);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(
    Math.min(f, fps - 1),
  ).padStart(2, "0")}`;
}

export function snapToFrame(time: number, fps: number) {
  return Math.round(time * fps) / fps;
}

export function createLayer(kind: LayerKind, index: number): Layer {
  const palette = ["#ffb347", "#63d2ff", "#ff7a92", "#9df58f", "#f5e663"];
  const color = palette[index % palette.length] ?? "#ffb347";
  const isText = kind === "text";
  return {
    id: uid("layer"),
    name:
      kind === "text"
        ? `Texto ${index + 1}`
          : kind === "ellipse"
          ? `Elipse ${index + 1}`
          : kind === "image"
            ? `Imagem ${index + 1}`
            : kind === "video"
              ? `Vídeo ${index + 1}`
            : kind === "model3d"
              ? `Objeto 3D ${index + 1}`
              : `Forma ${index + 1}`,
    kind,
    color,
    text: isText ? "Motion" : undefined,
    fontSize: isText ? 72 : undefined,
    width: isText ? 360 : kind === "model3d" || kind === "video" ? 320 : 200,
    height: isText ? 96 : kind === "model3d" || kind === "video" ? 180 : 200,
    radius: kind === "ellipse" ? 999 : kind === "model3d" ? 0 : 16,
    blend: "normal",
    visible: true,
    effects: { blur: 0, glow: 0, shadow: 0 },
    base: { ...DEFAULT_BASE },
    tracks: emptyTracks(),
  };
}

export function starterProject(): Layer[] {
  const a = createLayer("rect", 0);
  a.name = "Bloco";
  a.base.x = -220;
  a.tracks.x = [
    { id: uid("k"), time: 0, value: -260, easing: "easyEase" },
    { id: uid("k"), time: 1.4, value: 180, easing: "easeOut" },
    { id: uid("k"), time: 3, value: -60, easing: "linear" },
  ];
  a.tracks.rotation = [
    { id: uid("k"), time: 0, value: 0, easing: "easeInOut" },
    { id: uid("k"), time: 3, value: 180, easing: "linear" },
  ];

  const b = createLayer("ellipse", 1);
  b.name = "Círculo";
  b.width = 160;
  b.height = 160;
  b.base.x = 200;
  b.base.y = 90;
  b.blend = "screen";
  b.effects.glow = 28;
  b.base.glow = 28;
  b.tracks.scaleX = [
    { id: uid("k"), time: 0.2, value: 40, easing: "back" },
    { id: uid("k"), time: 1.6, value: 130, easing: "easeInOut" },
    { id: uid("k"), time: 3, value: 60, easing: "linear" },
  ];
  b.tracks.scaleY = [
    { id: uid("k"), time: 0.2, value: 40, easing: "back" },
    { id: uid("k"), time: 1.6, value: 130, easing: "easeInOut" },
    { id: uid("k"), time: 3, value: 60, easing: "linear" },
  ];

  const c = createLayer("text", 2);
  c.text = "MOTION";
  c.base.y = -180;
  c.tracks.opacity = [
    { id: uid("k"), time: 0.4, value: 0, easing: "easeOut" },
    { id: uid("k"), time: 1.2, value: 100, easing: "linear" },
    { id: uid("k"), time: 2.6, value: 100, easing: "easeIn" },
    { id: uid("k"), time: 3.2, value: 0, easing: "linear" },
  ];

  return [c, b, a];
}
