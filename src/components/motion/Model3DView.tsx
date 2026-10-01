import { useEffect, useRef, useState } from "react";
import type { Layer } from "@/lib/motion";
import { build3DKey, createModelRenderer, type ModelRenderer } from "@/lib/scene3d";

interface Props {
  layer: Layer;
  rotX: number;
  rotY: number;
  rotZ: number;
}

/** Renders an imported 3D model or extruded 3D text into a WebGL canvas. */
export function Model3DView({ layer, rotX, rotY, rotZ }: Props) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ModelRenderer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const key = build3DKey(layer);
  const { width, height } = layer;
  const layerRef = useRef(layer);
  layerRef.current = layer;

  useEffect(() => {
    let disposed = false;
    setStatus("loading");
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    createModelRenderer(layerRef.current, canvas)
      .then((r) => {
        if (disposed) return r.dispose();
        holderRef.current?.replaceChildren(canvas);
        rendererRef.current = r;
        setStatus("ready");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [key, width, height]);

  useEffect(() => {
    rendererRef.current?.render(rotX, rotY, rotZ);
  }, [rotX, rotY, rotZ, status]);

  return (
    <div className="relative" style={{ width, height }}>
      <div ref={holderRef} className="h-full w-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center text-[11px] text-muted-foreground">
          {status === "loading" ? "Carregando 3D..." : "Falha ao carregar o 3D"}
        </div>
      )}
    </div>
  );
}
