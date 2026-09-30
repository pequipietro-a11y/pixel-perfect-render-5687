import type { Layer, LayerKind } from "@/lib/motion";

interface Props {
  layers: Layer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (kind: LayerKind) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, dir: -1 | 1) => void;
  onImportImage: (file: File) => void;
  onImportVideo: (file: File) => void;
  onImport3D: (file: File) => void;
}

export function LayersPanel({
  layers,
  selectedId,
  onSelect,
  onAdd,
  onToggleVisible,
  onDelete,
  onReorder,
  onImportImage,
  onImportVideo,
  onImport3D,
}: Props) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Ativos
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button className="tool-btn" onClick={() => onAdd("rect")}>
            Retângulo
          </button>
          <button className="tool-btn" onClick={() => onAdd("ellipse")}>
            Elipse
          </button>
          <button className="tool-btn" onClick={() => onAdd("text")}>
            Texto
          </button>
          <label className="tool-btn cursor-pointer">
            Imagem
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportImage(f);
                e.target.value = "";
              }}
            />
          </label>
          <label className="tool-btn cursor-pointer">
            Objeto 3D
            <input
              type="file"
              accept=".glb,.gltf,.obj"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport3D(f);
                e.target.value = "";
              }}
            />
          </label>
          <label className="tool-btn cursor-pointer">
            Vídeo
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportVideo(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Camadas
        </h2>
        <div className="mt-2 flex-1 space-y-1 overflow-y-auto pr-1">
          {layers.map((layer, i) => (
            <div
              key={layer.id}
              onClick={() => onSelect(layer.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                layer.id === selectedId
                  ? "border-primary bg-panel-raised"
                  : "border-border bg-panel hover:bg-panel-raised"
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisible(layer.id);
                }}
                className={`h-3 w-3 shrink-0 rounded-full border ${
                  layer.visible ? "border-transparent" : "border-muted-foreground"
                }`}
                style={{
                  background: layer.visible ? layer.color : "transparent",
                }}
                title="Mostrar/ocultar"
              />
              <span className="flex-1 truncate">{layer.name}</span>
              <span className="opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  className="px-1 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder(layer.id, -1);
                  }}
                  disabled={i === 0}
                >
                  ↑
                </button>
                <button
                  className="px-1 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder(layer.id, 1);
                  }}
                  disabled={i === layers.length - 1}
                >
                  ↓
                </button>
                <button
                  className="px-1 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(layer.id);
                  }}
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
          {!layers.length && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhuma camada ainda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
