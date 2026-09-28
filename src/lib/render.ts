import { sampleLayer, type Layer } from "@/lib/motion";

export interface Background {
  color: string;
  image?: string | undefined;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function containRect(iw: number, ih: number, w: number, h: number) {
  const s = Math.min(w / iw, h / ih);
  return { w: iw * s, h: ih * s };
}

/** Renders an imported 3D model once into an offscreen canvas for video export. */
async function renderModelToCanvas(
  layer: Layer,
): Promise<HTMLCanvasElement | null> {
  if (!layer.src) return null;
  const THREE = await import("three");
  const w = Math.max(2, layer.width);
  const h = Math.max(2, layer.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(w, h, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);

  const buf = await (await fetch(layer.src)).arrayBuffer();
  let object: import("three").Group;
  if (layer.modelFormat === "obj") {
    const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
    object = new OBJLoader().parse(new TextDecoder().decode(buf));
  } else {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().parse(buf, "", res, rej),
    );
    object = (gltf as { scene: import("three").Group }).scene;
  }

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.set(-center.x, -center.y, -center.z);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  camera.position.set(0, 0, ((maxDim / 2) / Math.tan((22.5 * Math.PI) / 180)) * 1.2);
  camera.lookAt(0, 0, 0);
  const d = Math.PI / 180;
  object.rotation.set(
    (layer.rotX ?? 0) * d,
    (layer.rotY ?? 0) * d,
    (layer.rotZ ?? 0) * d,
  );
  scene.add(object);
  renderer.render(scene, camera);
  return canvas;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  layers: Layer[],
  time: number,
  bg: Background,
  images: Map<string, HTMLImageElement>,
  models: Map<string, HTMLCanvasElement>,
) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.fillStyle = bg.color;
  ctx.fillRect(0, 0, W, H);
  const bgImg = bg.image ? images.get(bg.image) : undefined;
  if (bgImg) {
    const s = Math.max(W / bgImg.width, H / bgImg.height);
    const w = bgImg.width * s;
    const h = bgImg.height * s;
    ctx.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h);
  }
  ctx.restore();

  for (const layer of [...layers].reverse()) {
    if (!layer.visible) continue;
    const v = sampleLayer(layer, time);
    ctx.save();
    ctx.translate(W / 2 + v.x, H / 2 + v.y);
    ctx.rotate((v.rotation * Math.PI) / 180);
    ctx.scale(v.scaleX / 100, v.scaleY / 100);
    ctx.globalAlpha = Math.max(0, Math.min(1, v.opacity / 100));
    ctx.globalCompositeOperation =
      layer.blend === "normal" ? "source-over" : layer.blend;
    const f: string[] = [];
    if (layer.effects.blur) f.push(`blur(${layer.effects.blur}px)`);
    if (layer.effects.glow)
      f.push(`drop-shadow(0 0 ${layer.effects.glow}px ${layer.color})`);
    if (layer.effects.shadow)
      f.push(
        `drop-shadow(0 ${layer.effects.shadow}px ${layer.effects.shadow * 1.4}px rgba(0,0,0,0.55))`,
      );
    ctx.filter = f.length ? f.join(" ") : "none";
    const w = layer.width;
    const h = layer.height;
    if (layer.kind === "text") {
      ctx.fillStyle = layer.color;
      ctx.font = `bold ${layer.fontSize ?? 48}px "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(layer.text ?? "", 0, 0);
    } else if (layer.kind === "image") {
      const img = layer.src ? images.get(layer.src) : undefined;
      if (img) {
        const r = containRect(img.width, img.height, w, h);
        ctx.drawImage(img, -r.w / 2, -r.h / 2, r.w, r.h);
      }
    } else if (layer.kind === "model3d") {
      const mc = layer.src ? models.get(layer.src) : undefined;
      if (mc) {
        const r = containRect(mc.width, mc.height, w, h);
        ctx.drawImage(mc, -r.w / 2, -r.h / 2, r.w, r.h);
      }
    } else {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      if (layer.kind === "ellipse") ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      else ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(layer.radius, w / 2, h / 2));
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Renders the animation in real time into a video file (MP4 when supported). */
export async function exportVideo(opts: {
  layers: Layer[];
  duration: number;
  fps: number;
  width: number;
  height: number;
  background: Background;
  onProgress?: (p: number) => void;
}): Promise<{ blob: Blob; ext: string }> {
  const { layers, duration, fps, width, height, background, onProgress } = opts;
  const images = new Map<string, HTMLImageElement>();
  const srcs = [
    ...layers.filter((l) => l.kind === "image" && l.src).map((l) => l.src as string),
    ...(background.image ? [background.image] : []),
  ];
  await Promise.all(
    srcs.map(async (s) => {
      try {
        images.set(s, await loadImage(s));
      } catch {
        /* ignore */
      }
    }),
  );
  await document.fonts?.ready;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  const types = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";

  drawFrame(ctx, width, height, layers, 0, background, images);
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();

  await new Promise<void>((resolve) => {
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      drawFrame(ctx, width, height, layers, Math.min(t, duration), background, images);
      onProgress?.(Math.min(1, t / duration));
      if (t >= duration) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await done;
  return { blob: new Blob(chunks, { type: mime.split(";")[0] ?? mime }), ext };
}
