import { useEffect, useRef, useState } from "react";
import { Pipette, RotateCcw, Scissors, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  chromaKeyImage,
  rgbToHex,
  tracePolygon,
  type PixelPoint,
} from "@/lib/imageProcessing";
import type { Layer } from "@/lib/motion";

interface Props {
  layer: Layer;
  onSplit: (src: string, w: number, h: number, name: string) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
}

const DISPLAY_W = 240;

/** Freehand lasso and chroma-key controls for an image layer. */
export function ImageCropTool({ layer, onSplit, onUpdateLayer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [points, setPoints] = useState<PixelPoint[]>([]);
  const [mode, setMode] = useState<"lasso" | "picker">("lasso");
  const [keyColor, setKeyColor] = useState("#00ff00");
  const [tolerance, setTolerance] = useState(34);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setPoints([]);
    };
    if (!layer.src) return;
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
    if (points.length > 1) {
      const accent =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--color-primary")
          .trim() || "#ffb347";
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      tracePolygon(ctx, points);
      ctx.fillStyle = "rgba(255, 179, 71, 0.18)";
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, imgSize.w / DISPLAY_W);
      ctx.setLineDash([8, 5]);
      tracePolygon(ctx, points);
      ctx.stroke();
      ctx.restore();
    }
  }, [points, imgSize]);

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
    if (mode === "picker") {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (context) {
        const pixel = context.getImageData(Math.min(Math.floor(p.x), canvas!.width - 1), Math.min(Math.floor(p.y), canvas!.height - 1), 1, 1).data;
        setKeyColor(rgbToHex(pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0));
        setMode("lasso");
      }
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    setPoints([p]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !imgSize) return;
    const p = toNatural(e);
    if (!p) return;
    setPoints((current) => {
      const last = current[current.length - 1];
      if (last && Math.hypot(last.x - p.x, last.y - p.y) < imgSize.w / DISPLAY_W) return current;
      return [...current, p];
    });
  };

  const onPointerUp = () => {
    drawingRef.current = false;
    setPoints((current) => (current.length >= 3 ? current : []));
  };

  const valid = points.length >= 3;

  /** Cut the selected area out into a brand-new image layer. */
  const separar = () => {
    const img = imgRef.current;
    if (!img || !valid) return;
    const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x))));
    const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y))));
    const maxX = Math.min(img.naturalWidth, Math.ceil(Math.max(...points.map((point) => point.x))));
    const maxY = Math.min(img.naturalHeight, Math.ceil(Math.max(...points.map((point) => point.y))));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.translate(-minX, -minY);
    if (!tracePolygon(ctx, points)) return;
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    onSplit(c.toDataURL("image/png"), width, height, `${layer.name} (parte)`);
  };

  /** Erase the selected area from the image itself. */
  const remover = () => {
    const img = imgRef.current;
    if (!img || !valid || !imgSize) return;
    const c = document.createElement("canvas");
    c.width = imgSize.w;
    c.height = imgSize.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    if (!tracePolygon(ctx, points)) return;
    ctx.fill();
    ctx.restore();
    onUpdateLayer(layer.id, { src: c.toDataURL("image/png") });
    setPoints([]);
  };

  const removeBackground = async () => {
    if (!layer.src) return;
    setProcessing(true);
    try {
      const src = await chromaKeyImage(layer.src, keyColor, tolerance);
      onUpdateLayer(layer.id, { src });
      setPoints([]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Separar imagem
      </h3>
      <p className="text-[11px] text-muted-foreground">
        Desenhe à mão livre em volta da parte que deseja separar.
      </p>
      <div className="overflow-hidden rounded-md border border-border">
        <canvas
          ref={canvasRef}
          style={{ width: DISPLAY_W, height: dispH }}
          className={`block touch-none ${mode === "picker" ? "cursor-copy" : "cursor-crosshair"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] text-muted-foreground">
          {valid ? `${points.length} pontos · seleção fechada` : "Nenhuma seleção"}
        </p>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Limpar seleção" onClick={() => setPoints([])}>
          <RotateCcw />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="outline" size="sm" disabled={!valid} onClick={separar}><Scissors />Separar</Button>
        <Button variant="outline" size="sm" disabled={!valid} onClick={remover}>Apagar área</Button>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Remover fundo</h3>
        <div className="flex items-center gap-2">
          <input type="color" aria-label="Cor do fundo" value={keyColor} onChange={(e) => setKeyColor(e.target.value)} className="h-8 w-10 rounded border border-border bg-transparent" />
          <Button variant={mode === "picker" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setMode((current) => current === "picker" ? "lasso" : "picker")}>
            <Pipette />Conta-gotas
          </Button>
        </div>
        <label className="block text-xs text-muted-foreground">
          <span className="flex justify-between"><span>Tolerância</span><span className="font-mono">{tolerance}</span></span>
          <input type="range" min={1} max={100} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-primary)]" />
        </label>
        <Button size="sm" className="w-full" disabled={processing} onClick={removeBackground}>
          <WandSparkles />{processing ? "Removendo..." : "Aplicar chroma key"}
        </Button>
      </div>
    </div>
  );
}
