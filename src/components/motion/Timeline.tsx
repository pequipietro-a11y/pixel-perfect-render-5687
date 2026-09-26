import { useRef } from "react";
import {
  PROP_KEYS,
  PROP_LABELS,
  formatTime,
  snapToFrame,
  type Layer,
  type PropKey,
} from "@/lib/motion";

interface Props {
  layers: Layer[];
  selectedId: string | null;
  time: number;
  duration: number;
  fps: number;
  playing: boolean;
  loop: boolean;
  onSelect: (id: string) => void;
  onSeek: (t: number) => void;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onFps: (fps: number) => void;
  onDuration: (d: number) => void;
  onMoveKeyframe: (
    layerId: string,
    key: PropKey,
    kfId: string,
    time: number,
  ) => void;
  onRemoveKeyframe: (layerId: string, key: PropKey, kfId: string) => void;
}

const LABEL_W = 168;

export function Timeline(props: Props) {
  const {
    layers,
    selectedId,
    time,
    duration,
    fps,
    playing,
    loop,
    onSelect,
    onSeek,
    onTogglePlay,
    onStop,
    onToggleLoop,
    onFps,
    onDuration,
    onMoveKeyframe,
    onRemoveKeyframe,
  } = props;

  const trackRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const posFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return snapToFrame(ratio * duration, fps);
  };

  const ticks = Math.max(1, Math.round(duration));

  return (
    <div className="flex h-full flex-col bg-panel">
      {/* transport */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <button className="tool-btn w-16" onClick={onTogglePlay}>
          {playing ? "Pause" : "Play"}
        </button>
        <button className="tool-btn" onClick={onStop}>
          Stop
        </button>
        <button
          className="tool-btn"
          onClick={onToggleLoop}
          style={loop ? { borderColor: "var(--color-primary)" } : undefined}
        >
          Loop {loop ? "on" : "off"}
        </button>
        <span className="ml-1 font-mono text-sm text-primary">
          {formatTime(time, fps)}
        </span>
        <label className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          FPS
          <select
            value={fps}
            onChange={(e) => onFps(Number(e.target.value))}
            className="num-field w-16"
          >
            {[24, 25, 30, 50, 60].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          Duração (s)
          <input
            type="number"
            min={1}
            max={60}
            value={duration}
            onChange={(e) => onDuration(Math.max(1, Number(e.target.value)))}
            className="num-field w-16"
          />
        </label>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* labels */}
        <div
          className="shrink-0 overflow-hidden border-r border-border"
          style={{ width: LABEL_W }}
        >
          <div className="h-7 border-b border-border" />
          <div className="overflow-y-auto">
            {layers.map((layer) => (
              <div key={layer.id}>
                <div
                  onClick={() => onSelect(layer.id)}
                  className={`flex h-7 cursor-pointer items-center gap-2 border-b border-border px-2 text-xs ${
                    layer.id === selectedId ? "bg-panel-raised text-primary" : ""
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: layer.color }}
                  />
                  <span className="truncate">{layer.name}</span>
                </div>
                {layer.id === selectedId &&
                  PROP_KEYS.filter((k) => layer.tracks[k].length > 0).map(
                    (k) => (
                      <div
                        key={k}
                        className="flex h-6 items-center border-b border-border pl-7 text-[11px] text-muted-foreground"
                      >
                        {PROP_LABELS[k]}
                      </div>
                    ),
                  )}
              </div>
            ))}
          </div>
        </div>

        {/* tracks */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div
            ref={trackRef}
            className="relative h-full"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).dataset["kf"]) return;
              scrubbing.current = true;
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              onSeek(posFromEvent(e.clientX));
            }}
            onPointerMove={(e) => {
              if (scrubbing.current) onSeek(posFromEvent(e.clientX));
            }}
            onPointerUp={() => (scrubbing.current = false)}
          >
            {/* ruler */}
            <div className="relative h-7 border-b border-border">
              {Array.from({ length: ticks + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-border pl-1 text-[10px] text-muted-foreground"
                  style={{ left: `${(i / duration) * 100}%` }}
                >
                  {i}s
                </div>
              ))}
            </div>

            <div className="overflow-y-auto">
              {layers.map((layer) => {
                const rows =
                  layer.id === selectedId
                    ? PROP_KEYS.filter((k) => layer.tracks[k].length > 0)
                    : [];
                return (
                  <div key={layer.id}>
                    <div className="relative h-7 border-b border-border">
                      <div
                        className="absolute inset-y-1.5 left-0 right-0 rounded-sm opacity-25"
                        style={{ background: layer.color }}
                      />
                      {PROP_KEYS.flatMap((k) => layer.tracks[k]).map((kf) => (
                        <span
                          key={kf.id}
                          className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-foreground/70"
                          style={{ left: `${(kf.time / duration) * 100}%` }}
                        />
                      ))}
                    </div>
                    {rows.map((k) => (
                      <div key={k} className="relative h-6 border-b border-border">
                        {layer.tracks[k].map((kf) => (
                          <KeyframeDot
                            key={kf.id}
                            left={(kf.time / duration) * 100}
                            onDrag={(clientX) =>
                              onMoveKeyframe(
                                layer.id,
                                k,
                                kf.id,
                                posFromEvent(clientX),
                              )
                            }
                            onRemove={() =>
                              onRemoveKeyframe(layer.id, k, kf.id)
                            }
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* playhead */}
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-playhead"
              style={{ left: `${(time / duration) * 100}%` }}
            >
              <div className="-ml-1.5 h-2 w-3 bg-playhead" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyframeDot({
  left,
  onDrag,
  onRemove,
}: {
  left: number;
  onDrag: (clientX: number) => void;
  onRemove: () => void;
}) {
  const dragging = useRef(false);
  return (
    <span
      data-kf="1"
      onPointerDown={(e) => {
        e.stopPropagation();
        dragging.current = true;
        (e.target as Element).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (dragging.current) {
          e.stopPropagation();
          onDrag(e.clientX);
        }
      }}
      onPointerUp={() => (dragging.current = false)}
      onDoubleClick={onRemove}
      title="Arraste para mover, duplo clique para remover"
      className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize border border-primary bg-primary"
      style={{ left: `${left}%` }}
    />
  );
}
