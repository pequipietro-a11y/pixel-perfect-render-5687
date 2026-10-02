import { useRef, useState } from "react";
import { sampleLayer, type Layer } from "@/lib/motion";
import type { Background } from "@/lib/render";
import {
  cameraOffsetAt,
  type CameraMotion,
  type TerrainPoint,
} from "@/lib/cameraTrack";
import { Model3DView } from "./Model3DView";
import { VideoLayerView } from "./VideoLayerView";

interface Props {
  layers: Layer[];
  time: number;
  zoom: number;
  width: number;
  height: number;
  selectedId: string | null;
  background: Background;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onEditText?: (id: string) => void;
  playing?: boolean;
  cameraMotion?: CameraMotion | null;
  terrainPoints?: TerrainPoint[] | null;
  onPickTerrain?: (p: TerrainPoint) => void;
}

export function CanvasStage({
  layers,
  time,
  zoom,
  width,
  height,
  selectedId,
  background = { color: "#1b2230" },
  onSelect,
  onMove,
  onEditText,
  playing = false,
  cameraMotion = null,
  terrainPoints = null,
  onPickTerrain,
}: Props) {
  const dragRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    onSelect(id);
    dragRef.current = { id, x: e.clientX, y: e.clientY };
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.x) / zoom;
    const dy = (e.clientY - drag.y) / zoom;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    dragRef.current = { ...drag, x: e.clientX, y: e.clientY };
    onMove(drag.id, dx, dy);
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-background p-6"
      onPointerDown={() => onSelect(null)}
    >
      <div
        className="relative overflow-hidden shadow-2xl"
        style={{
          width: width * zoom,
          height: height * zoom,
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundColor: background.color,
            backgroundImage:
              !background.video && background.image
                ? `url(${background.image})`
                : undefined,
          }}
        />
        {background.video && (
          <div className="absolute inset-0">
            <VideoLayerView src={background.video} time={time} playing={playing} cover />
          </div>
        )}
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{ transform: `scale(${zoom})` }}
        >
          {[...layers].reverse().map((layer) => {
            if (!layer.visible) return null;
            const v = sampleLayer(layer, time);
            // Camera-follow: shift the layer opposite to the tracked camera motion.
            if (layer.followCamera && cameraMotion) {
              const off = cameraOffsetAt(cameraMotion, time);
              v.x += off.x;
              v.y += off.y;
            }
            const selected = layer.id === selectedId;
            const is3d =
              layer.kind === "model3d" || (layer.kind === "text" && layer.text3d);
            const filters = [
              v.blur ? `blur(${v.blur}px)` : "",
              v.glow
                ? `drop-shadow(0 0 ${v.glow}px ${layer.color})`
                : "",
              v.shadow
                ? `drop-shadow(0 ${v.shadow}px ${v.shadow * 1.4}px rgba(0,0,0,0.55))`
                : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={layer.id}
                onPointerDown={(e) => handlePointerDown(e, layer.id)}
                onDoubleClick={() => layer.kind === "text" && onEditText?.(layer.id)}
                className={`absolute cursor-move select-none ${
                  selected && layer.kind !== "image" && !is3d
                    ? "outline outline-2 outline-primary"
                    : ""
                } ${dragging && selected ? "" : "transition-none"}`}
                style={{
                  width: layer.width,
                  height: layer.height,
                  left: -layer.width / 2,
                  top: -layer.height / 2,
                  opacity: v.opacity / 100,
                  mixBlendMode: layer.blend === "normal" ? undefined : layer.blend,
                  filter: filters || undefined,
                  transform: is3d
                    ? `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.scaleX / 100}, ${v.scaleY / 100})`
                    : `perspective(900px) translate3d(${v.x}px, ${v.y}px, 0) rotateX(${v.rotX}deg) rotateY(${v.rotY}deg) rotateZ(${v.rotation + v.rotZ}deg) scale(${v.scaleX / 100}, ${v.scaleY / 100})`,
                  transformStyle: "preserve-3d",
                }}
              >
                {layer.kind === "text" && layer.text3d ? (
                  <Model3DView
                    layer={layer}
                    rotX={v.rotX}
                    rotY={v.rotY}
                    rotZ={v.rotation + v.rotZ}
                  />
                ) : layer.kind === "text" ? (
                  <div
                    className="flex h-full w-full items-center justify-center whitespace-nowrap text-center font-display font-bold"
                    style={{ color: layer.color, fontSize: layer.fontSize }}
                  >
                    {layer.text}
                  </div>
                ) : layer.kind === "image" && layer.src ? (
                  <img
                    src={layer.src}
                    alt={layer.name}
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                ) : layer.kind === "video" && layer.src ? (
                  <VideoLayerView src={layer.src} time={time} playing={playing} />
                ) : layer.kind === "model3d" && layer.src ? (
                  <Model3DView
                    layer={layer}
                    rotX={v.rotX}
                    rotY={v.rotY}
                    rotZ={v.rotZ}
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{
                      background: layer.color,
                      borderRadius:
                        layer.kind === "ellipse" ? "50%" : layer.radius,
                    }}
                  />
                )}
              </div>
            );
          })}
          {terrainPoints?.map((p, i) => (
            <button
              key={i}
              title={`Ponto ${p.kind === "high" ? "alto" : "baixo"} — clique para posicionar o objeto 3D aqui`}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPickTerrain?.(p);
              }}
              className={`absolute z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-2 text-[10px] font-bold ${
                p.kind === "high"
                  ? "border-primary bg-primary/30 text-primary"
                  : "border-[#63d2ff] bg-[#63d2ff]/30 text-[#63d2ff]"
              }`}
              style={{ left: p.x * width - width / 2, top: p.y * height - height / 2 }}
            >
              {p.kind === "high" ? "▲" : "▼"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
