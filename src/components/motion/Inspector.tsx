import { useState } from "react";
import {
  PROP_KEYS,
  PROP_LABELS,
  PROP_UNITS,
  sampleLayer,
  type BlendMode,
  type EasingName,
  type Layer,
  type PropKey,
} from "@/lib/motion";
import { GraphEditor } from "./GraphEditor";
import { ImageCropTool } from "./ImageCropTool";

interface Props {
  layer: Layer | null;
  time: number;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  onSetValue: (id: string, key: PropKey, value: number) => void;
  onToggleKeyframe: (id: string, key: PropKey) => void;
  onSetEasing: (id: string, key: PropKey, easing: EasingName) => void;
  onSplitImage: (src: string, w: number, h: number, name: string) => void;
}

const BLENDS: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
];

export function Inspector({
  layer,
  time,
  onUpdateLayer,
  onSetValue,
  onToggleKeyframe,
  onSetEasing,
  onSplitImage,
}: Props) {
  const [graphProp, setGraphProp] = useState<PropKey>("x");

  if (!layer) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
        Selecione uma camada para editar suas propriedades.
      </div>
    );
  }

  const values = sampleLayer(layer, time);
  const track = layer.tracks[graphProp];
  const active = [...track]
    .sort((a, b) => a.time - b.time)
    .filter((k) => k.time <= time + 1e-6)
    .pop();

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Propriedades
        </h2>
        <input
          value={layer.name}
          onChange={(e) => onUpdateLayer(layer.id, { name: e.target.value })}
          className="num-field mt-2 font-sans text-sm"
        />
      </div>

      <div className="space-y-1.5">
        {PROP_KEYS.filter(
          (key) =>
            !key.startsWith("rot") ||
            layer.kind === "image" ||
            layer.kind === "video" ||
            layer.kind === "model3d",
        ).map((key) => {
          const hasKeys = layer.tracks[key].length > 0;
          const atKey = layer.tracks[key].some(
            (k) => Math.abs(k.time - time) < 1e-3,
          );
          return (
            <div key={key} className="flex items-center gap-2">
              <button
                onClick={() => onToggleKeyframe(layer.id, key)}
                title="Adicionar/remover keyframe neste tempo"
                className="grid h-5 w-5 shrink-0 place-items-center"
              >
                <span
                  className={`block h-2.5 w-2.5 rotate-45 border ${
                    atKey
                      ? "border-primary bg-primary"
                      : hasKeys
                        ? "border-primary bg-transparent"
                        : "border-muted-foreground bg-transparent"
                  }`}
                />
              </button>
              <button
                onClick={() => setGraphProp(key)}
                className={`flex-1 text-left text-xs ${
                  graphProp === key ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {PROP_LABELS[key]}
              </button>
              <div className="flex w-24 items-center gap-1">
                <input
                  type="number"
                  value={Math.round(values[key] * 100) / 100}
                  onChange={(e) =>
                    onSetValue(layer.id, key, Number(e.target.value))
                  }
                  className="num-field"
                />
                <span className="w-4 text-[10px] text-muted-foreground">
                  {PROP_UNITS[key]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">
          Curva de {PROP_LABELS[graphProp]}
          {active ? "" : " — sem keyframe antes do tempo atual"}
        </p>
        <GraphEditor
          easing={active?.easing ?? "easyEase"}
          onChange={(e) => onSetEasing(layer.id, graphProp, e)}
        />
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Aparência
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex-1 text-xs text-muted-foreground">Cor</label>
          <input
            type="color"
            value={layer.color}
            onChange={(e) => onUpdateLayer(layer.id, { color: e.target.value })}
            className="h-7 w-16 rounded border border-border bg-transparent"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            Largura
            <input
              type="number"
              value={layer.width}
              onChange={(e) =>
                onUpdateLayer(layer.id, { width: Number(e.target.value) })
              }
              className="num-field mt-1"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Altura
            <input
              type="number"
              value={layer.height}
              onChange={(e) =>
                onUpdateLayer(layer.id, { height: Number(e.target.value) })
              }
              className="num-field mt-1"
            />
          </label>
        </div>
        {layer.kind === "text" && (
          <>
            <label className="block text-xs text-muted-foreground">
              Texto
              <textarea
                value={layer.text ?? ""}
                onChange={(e) =>
                  onUpdateLayer(layer.id, { text: e.target.value })
                }
                rows={2}
                className="num-field mt-1 font-sans"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Tamanho da fonte
              <input
                type="number"
                value={layer.fontSize ?? 48}
                onChange={(e) =>
                  onUpdateLayer(layer.id, { fontSize: Number(e.target.value) })
                }
                className="num-field mt-1"
              />
            </label>
          </>
        )}
        {layer.kind !== "ellipse" &&
          layer.kind !== "text" &&
          layer.kind !== "model3d" && (
            <label className="block text-xs text-muted-foreground">
              Cantos arredondados
              <input
                type="range"
                min={0}
                max={120}
                value={layer.radius}
                onChange={(e) =>
                  onUpdateLayer(layer.id, { radius: Number(e.target.value) })
                }
                className="mt-1 w-full accent-[var(--color-primary)]"
              />
            </label>
          )}
        <label className="block text-xs text-muted-foreground">
          Modo de mesclagem
          <select
            value={layer.blend}
            onChange={(e) =>
              onUpdateLayer(layer.id, { blend: e.target.value as BlendMode })
            }
            className="num-field mt-1"
          >
            {BLENDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {layer.kind === "image" && layer.src && (
        <ImageCropTool
          layer={layer}
          onSplit={onSplitImage}
          onUpdateLayer={onUpdateLayer}
        />
      )}

    </div>
  );
}
