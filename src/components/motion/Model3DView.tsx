import { useEffect, useRef, useState } from "react";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

interface Props {
  src: string;
  format: "glb" | "gltf" | "obj";
  width: number;
  height: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Renders an imported 3D model (.glb/.gltf/.obj) into a small WebGL canvas. */
export function Model3DView({ src, format, width, height, rotX, rotY, rotZ }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let disposed = false;
    setStatus("loading");
    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const THREE = await import("three");
        const buf = await (await fetch(src)).arrayBuffer();
        if (disposed) return;

        let object: any;
        if (format === "obj") {
          const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
          object = new OBJLoader().parse(new TextDecoder().decode(buf));
        } else {
          const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
          const gltf: GLTF = await new Promise((res, rej) =>
            new GLTFLoader().parse(buf, "", res, rej),
          );
          object = gltf.scene;
        }
        if (disposed || !object) return;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        });
        renderer.setSize(width, height, false);
        const scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(2, 3, 4);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x88aaff, 0.6);
        rim.position.set(-3, -1, -2);
        scene.add(rim);
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);

        // Center the model and fit the camera to it.
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        object.position.set(-center.x, -center.y, -center.z);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const dist = (maxDim / 2) / Math.tan(((45 / 2) * Math.PI) / 180);
        camera.position.set(0, 0, dist * 1.2);
        camera.lookAt(0, 0, 0);
        scene.add(object);

        rendererRef.current = renderer;
        modelRef.current = object;
        sceneRef.current = scene;
        cameraRef.current = camera;
        setStatus("ready");
      } catch {
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      rendererRef.current?.dispose?.();
      rendererRef.current = null;
      modelRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, [src, format, width, height]);

  // Redraw whenever the rotation values change.
  useEffect(() => {
    const model = modelRef.current;
    const renderer = rendererRef.current;
    if (!model || !renderer) return;
    const d = Math.PI / 180;
    model.rotation.set(rotX * d, rotY * d, rotZ * d);
    renderer.render(sceneRef.current, cameraRef.current);
  }, [rotX, rotY, rotZ, status]);

  return (
    <div className="relative" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        className="block"
        style={{ width, height }}
      />
      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center text-[11px] text-muted-foreground">
          {status === "loading" ? "Carregando 3D..." : "Falha ao carregar o modelo"}
        </div>
      )}
    </div>
  );
}
