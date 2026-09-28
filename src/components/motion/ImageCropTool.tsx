import { useEffect, useRef, useState } from "react";
import type { Layer } from "@/lib/motion";

interface Props {
  layer: Layer;
  onSplit: (src: string, w: number, h: number, name: string) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DISPLAY_W = 240;

/** Rectangle selection tool: separates the selected area into a new image
 *  layer or erases it from the original (leaving transparency). */
export function ImageCropTool({ layer, onSplit, onUpdateLayer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [sel, setSel] = useState<Rect | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setSel(null);
    };
    img.src = layer.src;
  }, [layer.src]);

  const dispH = imgSize
    ? Math.max(1, Math.round((imgSize.h / imgSize.w) * DISPLAY_W))
    : 120;

  // Draw the image plus the current selection overlay.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgSize) return;
    canvas.width = imgSize.w;
    canvas.height = imgSize.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    if (sel && sel.w > 1 && sel.h > 1) {
      const accent =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--color-primary")
          .trim() || "#ffb347";
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.rect(sel.x, sel.y, sel.w, sel.h);
      ctx.fill("evenodd");
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, imgSize.w / DISPLAY_W);
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);
      ctx.restore();
    }
  }, [sel, imgSize]);

  const toNatural = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !imgSize) return null;
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * imgSize.w;
    const ny = ((e.clientY - rect.top) / rect.height) * imgSize.h;
    return {
      x: Math.max(0, Math.min(imgSize.w, nx)),
      y: Math.max(0, Math.min(imgSize.h, ny)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = toNatural(e);
    if (!p) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    startRef.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start || !imgSize) return;
    const p = toNatural(e);
    if (!p) return;
    setSel({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    });
  };

  const onPointerUp = () => {
    startRef.current = null;
    setSel((s) => (s && s.w >= 4 && s.h >= 4 ? s : null));
  };

  const r: Rect | null = sel
    ? {
        x: Math.round(sel.x),
        y: Math.round(sel.y),
        w: Math.round(sel.w),
        h: Math.round(sel.h),
      }
    : null;
  const valid = !!r && r.w >= 2 && r.h >= 2;

  /** Cut the selected area out into a brand-new image layer. */
  const separar = () => {
    const img = imgRef.current;
    if (!img || !r || !valid) return;
    const c = document.createElement("canvas");
    c.width = r.w;
    c.height = r.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    onSplit(c.toDataURL("image/png"), r.w, r.h, `${layer.name} (parte)`);
  };

  /** Erase the selected area from the image itself. */
  const remover = () => {
    const img = imgRef.current;
    if (!img || !r || !valid || !imgSize) return;
    const c = document.createElement("canvas");
    c.width = imgSize.w;
    c.height = imgSize.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    ctx.clearRect(r.x, r.y, r.w, r.h);
    onUpdateLayer(layer.id, { src: c.toDataURL("image/png") });
    setSel(null);
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Recortar imagem
      </h3>
      <p className="text-[11px] text-muted-foreground">
        Arraste sobre a imagem para marcar uma área.
      </p>
      <div className="overflow-hidden rounded-md border border-border">
        <canvas
          ref={canvasRef}
          style={{ width: DISPLAY_W, height: dispH }}
          className="block cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        {r && valid
          ? `X ${r.x} · Y ${r.y} · ${r.w}×${r.h}px`
          : "Nenhuma seleção"}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <button className="tool-btn" disabled={!valid} onClick={separar}>
          Separar seleção
        </button>
        <button className="tool-btn" disabled={!valid} onClick={remover}>
          Remover seleção
        </button>
      </div>
    </div>
  );
}
