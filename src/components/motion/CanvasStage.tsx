import { useRef, useState } from "react";
import { type Layer } from "@/lib/motion";
import { boneMatrix, sampleRigLayer } from "@/lib/rig";
import { sampleLayer } from "@/lib/motion";
import { Vector3 } from "three";
import type { Background } from "@/lib/render";
import {
  cameraOffsetAt,
  cameraViewAt,
  isOutsideFrame,
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
            const v = sampleRigLayer(layer, layers, time);
            // Camera-follow: shift the layer opposite to the tracked camera motion.
            if (layer.followCamera && cameraMotion) {
              const off = cameraOffsetAt(cameraMotion, time);
              v.x += off.x;
              v.y += off.y;
            }
            const selected = layer.id === selectedId;
            const is3d =
              layer.kind === "model3d" || (layer.kind === "text" && layer.text3d);
            if (is3d && layer.followCamera && cameraMotion &&
              isOutsideFrame(v.x, v.y, layer.width * Math.abs(v.scaleX / 100), layer.height * Math.abs(v.scaleY / 100), width, height)) return null;
            const view = is3d && layer.followCamera && layer.cameraAngle && cameraMotion
              ? cameraViewAt(cameraMotion, time) : { x: 0, y: 0 };
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

            // Ghost ("sombra") of where the selected layer was at the previous keyframe.
            let ghost: ReturnType<typeof sampleRigLayer> | null = null;
            if (selected && !playing) {
              const times: number[] = [];
              for (const tr of Object.values(layer.tracks ?? {})) for (const k of tr ?? []) times.push(k.time);
              for (const b of layer.rig?.bones ?? []) for (const tr of Object.values(b.tracks)) for (const k of tr) times.push(k.time);
              const prev = times.filter((t) => t < time - 1e-3).sort((a, b) => b - a)[0];
              if (prev !== undefined) {
                const g = sampleRigLayer(layer, layers, prev);
                if (Math.abs(g.x - v.x) > 0.5 || Math.abs(g.y - v.y) > 0.5 || Math.abs((g.rotation + g.rotZ) - (v.rotation + v.rotZ)) > 0.5) ghost = g;
              }
            }

            return (
              <Fragment key={layer.id}>
              {ghost && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/15"
                  style={{
                    width: layer.width, height: layer.height,
                    left: -layer.width / 2, top: -layer.height / 2,
                    borderRadius: layer.kind === "ellipse" ? "50%" : layer.radius,
                    opacity: 0.6,
                    transform: `translate(${ghost.x}px, ${ghost.y}px) rotate(${ghost.rotation + ghost.rotZ}deg) scale(${ghost.scaleX / 100}, ${ghost.scaleY / 100})`,
                  }}
                />
              )}
              <div
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
                    rotX={v.rotX + view.x}
                    rotY={v.rotY + view.y}
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
                    rotX={v.rotX + view.x}
                    rotY={v.rotY + view.y}
                    rotZ={v.rotation + v.rotZ}
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
          {(() => {
            const owner = layers.find((l) => l.id === selectedId && l.rig);
            if (!owner?.rig) return null;
            const a = sampleLayer(owner, time);
            const pt = (id: string) => new Vector3().applyMatrix4(boneMatrix(owner.rig!, id, time));
            return (
              <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0 }} width={1} height={1}>
                {owner.rig.bones.map((b) => {
                  const p = pt(b.id);
                  const q = b.parentId ? pt(b.parentId) : null;
                  return (
                    <g key={b.id}>
                      {q && <line x1={a.x + q.x} y1={a.y + q.y} x2={a.x + p.x} y2={a.y + p.y} stroke="var(--primary)" strokeWidth={4} strokeLinecap="round" />}
                      <circle cx={a.x + p.x} cy={a.y + p.y} r={6} fill="var(--primary)" />
                    </g>
                  );
                })}
              </svg>
            );
          })()}
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
