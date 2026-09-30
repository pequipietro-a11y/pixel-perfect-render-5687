import { sampleLayer, type Layer } from "@/lib/motion";

/** Builds a 3D scene from the layers at a given time and downloads it as .glb */
export async function export3D(layers: Layer[], time: number, depth = 40) {
  const THREE = await import("three");
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const scene = new THREE.Scene();
  const S = 0.01; // 100px = 1 metro

  const loadTex = (src: string) =>
    new Promise<InstanceType<typeof THREE.Texture>>((res) => {
      const img = new Image();
      img.onload = () => {
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        res(t);
      };
      img.src = src;
    });

  const textTexture = (layer: Layer) => {
    const c = document.createElement("canvas");
    c.width = Math.max(2, layer.width * 2);
    c.height = Math.max(2, layer.height * 2);
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = layer.color;
      ctx.font = `bold ${(layer.fontSize ?? 48) * 2}px "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(layer.text ?? "", c.width / 2, c.height / 2);
    }
    return new Promise<InstanceType<typeof THREE.Texture>>((res) => {
      const img = new Image();
      img.onload = () => {
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        res(t);
      };
      img.src = c.toDataURL("image/png");
    });
  };

  const loadVideoTex = (src: string) =>
    new Promise<InstanceType<typeof THREE.Texture>>((res, rej) => {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "auto";
      video.onloadeddata = () => {
        const target = Number.isFinite(video.duration) && video.duration > 0
          ? time % video.duration
          : 0;
        const finish = () => {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(2, video.videoWidth);
          canvas.height = Math.max(2, video.videoHeight);
          canvas.getContext("2d")?.drawImage(video, 0, 0);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          res(texture);
        };
        if (target > 0) {
          video.addEventListener("seeked", finish, { once: true });
          video.currentTime = target;
        } else finish();
      };
      video.onerror = rej;
      video.src = src;
    });

  const ordered = [...layers].reverse();
  for (let i = 0; i < ordered.length; i++) {
    const layer = ordered[i];
    if (!layer || !layer.visible) continue;
    const v = sampleLayer(layer, time);
    const w = layer.width;
    const h = layer.height;
    let mesh: InstanceType<typeof THREE.Mesh>;
    const opacity = v.opacity / 100;

    if (layer.kind === "rect" || layer.kind === "ellipse") {
      const shape = new THREE.Shape();
      if (layer.kind === "ellipse") {
        shape.absellipse(0, 0, w / 2, h / 2, 0, Math.PI * 2, false, 0);
      } else {
        const r = Math.min(layer.radius, w / 2, h / 2);
        const x = -w / 2, y = -h / 2;
        shape.moveTo(x + r, y);
        shape.lineTo(x + w - r, y);
        shape.quadraticCurveTo(x + w, y, x + w, y + r);
        shape.lineTo(x + w, y + h - r);
        shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        shape.lineTo(x + r, y + h);
        shape.quadraticCurveTo(x, y + h, x, y + h - r);
        shape.lineTo(x, y + r);
        shape.quadraticCurveTo(x, y, x + r, y);
      }
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSize: Math.min(6, depth / 4),
        bevelThickness: Math.min(6, depth / 4),
        curveSegments: 32,
      });
      geo.translate(0, 0, -depth / 2);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: layer.color,
          roughness: 0.45,
          transparent: opacity < 1,
          opacity,
        }),
      );
    } else {
      const map = layer.kind === "video" && layer.src
        ? await loadVideoTex(layer.src)
        : layer.kind === "image" && layer.src
          ? await loadTex(layer.src)
          : await textTexture(layer);
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map, transparent: true, opacity, side: THREE.DoubleSide }),
      );
    }
    mesh.name = layer.name;
    mesh.scale.set((v.scaleX / 100) * S, (v.scaleY / 100) * S, S);
    mesh.position.set(v.x * S, -v.y * S, i * 0.05);
    mesh.rotation.set(
      (v.rotX * Math.PI) / 180,
      (v.rotY * Math.PI) / 180,
      (-(v.rotation + v.rotZ) * Math.PI) / 180,
    );
    scene.add(mesh);
  }

  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true });
  const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cena-3d.glb";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
