// Shared 3D scene builder (imported models and extruded 3D text). Browser only.
import type { Layer } from "@/lib/motion";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function is3DLayer(l: Layer) {
  return (l.kind === "model3d" && !!l.src) || (l.kind === "text" && !!l.text3d);
}

/** Cache key: rebuild the 3D object only when its geometry inputs change. */
export function build3DKey(l: Layer) {
  return l.kind === "text"
    ? `t|${l.text}|${l.color}|${l.depth ?? 30}|${l.fontSize ?? 72}`
    : `m|${l.src?.length}|${l.src?.slice(-64)}|${l.modelFormat}`;
}

let fontPromise: Promise<any> | null = null;
function loadFont() {
  if (!fontPromise) {
    fontPromise = (async () => {
      const { FontLoader } = await import("three/examples/jsm/loaders/FontLoader.js");
      const json = await (await fetch("/fonts/helvetiker_bold.typeface.json")).json();
      return new FontLoader().parse(json);
    })();
  }
  return fontPromise;
}

async function buildObject(layer: Layer): Promise<any> {
  const THREE = await import("three");
  if (layer.kind === "text") {
    const { TextGeometry } = await import("three/examples/jsm/geometries/TextGeometry.js");
    const font = await loadFont();
    const size = layer.fontSize ?? 72;
    // Typeface has no accents: strip diacritics so letters still render.
    const text = (layer.text || " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const geo = new TextGeometry(text, {
      font,
      size,
      depth: layer.depth ?? 30,
      curveSegments: 6,
      bevelEnabled: true,
      bevelThickness: Math.max(1, size * 0.04),
      bevelSize: Math.max(0.5, size * 0.025),
      bevelSegments: 3,
    } as any);
    const color = new THREE.Color(layer.color);
    const mat = [
      new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.35 }),
      new THREE.MeshStandardMaterial({
        color: color.clone().multiplyScalar(0.55),
        metalness: 0.2,
        roughness: 0.5,
      }),
    ];
    return new THREE.Mesh(geo, mat);
  }
  if (!layer.src) throw new Error("sem arquivo");
  const buf = await (await fetch(layer.src)).arrayBuffer();
  if (layer.modelFormat === "obj") {
    const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
    return new OBJLoader().parse(new TextDecoder().decode(buf));
  }
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const gltf: any = await new Promise((res, rej) => new GLTFLoader().parse(buf, "", res, rej));
  return gltf.scene;
}

export interface ModelRenderer {
  canvas: HTMLCanvasElement;
  render: (rotX: number, rotY: number, rotZ: number) => void;
  dispose: () => void;
}

/** Builds a lit scene around the layer's object, fitted to the camera. */
export async function createModelRenderer(
  layer: Layer,
  canvas: HTMLCanvasElement = document.createElement("canvas"),
): Promise<ModelRenderer> {
  const THREE = await import("three");
  const w = Math.max(2, Math.round(layer.width));
  const h = Math.max(2, Math.round(layer.height));
  canvas.width = w;
  canvas.height = h;
  const object = await buildObject(layer);
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
  const rim = new THREE.DirectionalLight(0x88aaff, 0.6);
  rim.position.set(-3, -1, -2);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100000);

  const pivot = new THREE.Group();
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.set(-center.x, -center.y, -center.z);
  pivot.add(object);
  scene.add(pivot);
  const tan = Math.tan((22.5 * Math.PI) / 180);
  const fitH = size.y / 2 / tan;
  const fitW = size.x / 2 / tan / (w / h);
  const dist = Math.max(fitH, fitW, size.z) || 1;
  camera.position.set(0, 0, dist * 1.15 + size.z / 2);
  camera.lookAt(0, 0, 0);

  const d = Math.PI / 180;
  return {
    canvas,
    render: (rx, ry, rz) => {
      pivot.rotation.set(rx * d, ry * d, rz * d);
      renderer.render(scene, camera);
    },
    dispose: () => renderer.dispose(),
  };
}
