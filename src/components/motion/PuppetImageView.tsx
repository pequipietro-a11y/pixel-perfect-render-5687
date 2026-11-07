import { useEffect, useRef } from "react";
import { DEFAULT_BASE, type Layer } from "@/lib/motion";
import { puppetDeformer } from "@/lib/puppet";
import { drawPerspective } from "@/lib/render";

export function PuppetImageView({ layer, time }: { layer: Layer; time: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const latest = useRef({ layer, time });
  latest.current = { layer, time };
  const paint = () => {
    const canvas = ref.current;
    const img = image.current;
    const { layer: l, time: t } = latest.current;
    if (!canvas || !img || !l.rig) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = Math.min(l.width / img.width, l.height / img.height);
    drawPerspective(ctx, img, img.width, img.height, img.width * s, img.height * s, DEFAULT_BASE, canvas.width, canvas.height, puppetDeformer(l.rig, t));
  };
  useEffect(() => {
    const img = new Image();
    let disposed = false;
    img.onload = () => { if (!disposed) { image.current = img; paint(); } };
    img.src = layer.src ?? "";
    return () => { disposed = true; image.current = null; };
  }, [layer.src]);
  useEffect(paint, [layer, time]);
  return <canvas ref={ref} aria-label={`Marionete ${layer.name}`} width={layer.width * 3} height={layer.height * 3} className="pointer-events-none absolute max-w-none" style={{ width: layer.width * 3, height: layer.height * 3, left: -layer.width, top: -layer.height }} />;
}