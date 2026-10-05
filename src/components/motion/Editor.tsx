import { useCallback, useEffect, useRef, useState } from "react";
import { CanvasStage } from "@/components/motion/CanvasStage";
import { Inspector } from "@/components/motion/Inspector";
import { LayersPanel } from "@/components/motion/LayersPanel";
import { Timeline } from "@/components/motion/Timeline";
import { export3D } from "@/lib/export3d";
import {
  analyzeCameraMotion,
  analyzeTerrain,
  cameraOffsetAt,
  cameraViewAt,
  type CameraMotion,
  type TerrainPoint,
} from "@/lib/cameraTrack";
import { removeConnectedPngBackground } from "@/lib/imageProcessing";
import { exportVideo, type Background } from "@/lib/render";
import {
  PROP_KEYS,
  createLayer,
  sampleLayer,
  snapToFrame,
  starterProject,
  uid,
  type EasingName,
  type Layer,
  type LayerKind,
  type PropKey,
} from "@/lib/motion";

export function Editor() {
  const [layers, setLayers] = useState<Layer[]>(() => starterProject());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(4);
  const [fps, setFps] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [zoom, setZoom] = useState(0.7);
  const [background, setBackground] = useState<Background>({ color: "#1b2230" });
  const [exporting, setExporting] = useState<number | null>(null);
  const [cameraMotion, setCameraMotion] = useState<CameraMotion | null>(null);
  const [terrainPoints, setTerrainPoints] = useState<TerrainPoint[] | null>(null);
  const [tracking, setTracking] = useState<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  // Render loop driven by requestAnimationFrame, snapped to the project FPS.
  useEffect(() => {
    if (!playing) return;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setTime((t) => {
        const next = t + dt;
        if (next >= duration) {
          if (loop) return next % duration;
          setPlaying(false);
          return duration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, duration, loop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && /input|select|textarea/i.test(target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.code === "ArrowRight")
        setTime((t) => Math.min(duration, snapToFrame(t + 1 / fps, fps)));
      if (e.code === "ArrowLeft")
        setTime((t) => Math.max(0, snapToFrame(t - 1 / fps, fps)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duration, fps]);

  const selected = layers.find((l) => l.id === selectedId) ?? null;

  const patchLayer = useCallback(
    (id: string, fn: (l: Layer) => Layer) =>
      setLayers((ls) => ls.map((l) => (l.id === id ? fn(l) : l))),
    [],
  );

  const updateLayer = useCallback(
    (id: string, patch: Partial<Layer>) =>
      patchLayer(id, (l) => ({ ...l, ...patch })),
    [patchLayer],
  );

  /** Set a property value: writes a keyframe when the track is animated. */
  const setValue = useCallback(
    (id: string, key: PropKey, value: number) =>
      patchLayer(id, (l) => {
        const t = snapToFrame(time, fps);
        const currentTrack = l.tracks[key] ?? [];
        if (!currentTrack.length) {
          return { ...l, base: { ...l.base, [key]: value } };
        }
        const existing = currentTrack.find((k) => Math.abs(k.time - t) < 1e-3);
        const track = existing
          ? currentTrack.map((k) => (k.id === existing.id ? { ...k, value } : k))
          : [
              ...currentTrack,
              { id: uid("k"), time: t, value, easing: "easyEase" as EasingName },
            ].sort((a, b) => a.time - b.time);
        return { ...l, tracks: { ...l.tracks, [key]: track } };
      }),
    [patchLayer, time, fps],
  );

  const toggleKeyframe = useCallback(
    (id: string, key: PropKey) =>
      patchLayer(id, (l) => {
        const t = snapToFrame(time, fps);
        const currentTrack = l.tracks[key] ?? [];
        const existing = currentTrack.find((k) => Math.abs(k.time - t) < 1e-3);
        if (existing) {
          return {
            ...l,
            tracks: {
              ...l.tracks,
              [key]: currentTrack.filter((k) => k.id !== existing.id),
            },
          };
        }
        const value = sampleLayer(l, t)[key];
        return {
          ...l,
          tracks: {
            ...l.tracks,
            [key]: [
              ...currentTrack,
              { id: uid("k"), time: t, value, easing: "easyEase" as EasingName },
            ].sort((a, b) => a.time - b.time),
          },
        };
      }),
    [patchLayer, time, fps],
  );

  const setEasing = useCallback(
    (id: string, key: PropKey, easing: EasingName) =>
      patchLayer(id, (l) => {
        const sorted = [...(l.tracks[key] ?? [])].sort((a, b) => a.time - b.time);
        const active = sorted.filter((k) => k.time <= time + 1e-6).pop();
        if (!active) return l;
        return {
          ...l,
          tracks: {
            ...l.tracks,
            [key]: (l.tracks[key] ?? []).map((k) =>
              k.id === active.id ? { ...k, easing } : k,
            ),
          },
        };
      }),
    [patchLayer, time],
  );

  const moveLayer = useCallback(
    (id: string, dx: number, dy: number) => {
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;
      const v = sampleLayer(layer, time);
      setValue(id, "x", Math.round(v.x + dx));
      setValue(id, "y", Math.round(v.y + dy));
    },
    [layers, time, setValue],
  );

  const addLayer = (kind: LayerKind) => {
    const layer = createLayer(kind, layers.length);
    setLayers((ls) => [layer, ...ls]);
    setSelectedId(layer.id);
  };

  const importImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = async () => {
        const layer = createLayer("image", layers.length);
        const s = Math.min(1, 500 / Math.max(img.width, img.height));
        layer.src = file.name.toLowerCase().endsWith(".png")
          ? await removeConnectedPngBackground(src)
          : src;
        layer.name = file.name;
        layer.width = Math.round(img.width * s);
        layer.height = Math.round(img.height * s);
        layer.radius = 0;
        setLayers((ls) => [layer, ...ls]);
        setSelectedId(layer.id);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const importVideo = (file: File) => {
    const src = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const layer = createLayer("video", layers.length);
      const s = Math.min(1, 560 / Math.max(video.videoWidth, video.videoHeight));
      layer.src = src;
      layer.name = file.name;
      layer.width = Math.max(1, Math.round(video.videoWidth * s));
      layer.height = Math.max(1, Math.round(video.videoHeight * s));
      layer.radius = 0;
      setLayers((ls) => [layer, ...ls]);
      setSelectedId(layer.id);
    };
    video.onerror = () => URL.revokeObjectURL(src);
    video.src = src;
  };

  /** Adds an image layer from a cropped piece (used by the crop tool). */
  const addImageLayer = (src: string, w: number, h: number, name: string) => {
    const layer = createLayer("image", layers.length);
    const s = Math.min(1, 500 / Math.max(w, h));
    layer.src = src;
    layer.name = name;
    layer.width = Math.max(1, Math.round(w * s));
    layer.height = Math.max(1, Math.round(h * s));
    layer.radius = 0;
    setLayers((ls) => [layer, ...ls]);
    setSelectedId(layer.id);
  };

  /** Imports a 3D model (.glb/.gltf/.obj) as a model3d layer. */
  const import3D = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const layer = createLayer("model3d", layers.length);
      const lower = file.name.toLowerCase();
      layer.src = src;
      layer.modelFormat = lower.endsWith(".obj")
        ? "obj"
        : lower.endsWith(".gltf")
          ? "gltf"
          : "glb";
      layer.name = file.name;
      setLayers((ls) => [layer, ...ls]);
      setSelectedId(layer.id);
    };
    reader.readAsDataURL(file);
  };

  const keyframeAll = (add: boolean) => {
    if (!selectedId) return;
    patchLayer(selectedId, (l) => {
      const t = snapToFrame(time, fps);
      const v = sampleLayer(l, t);
      const tracks = { ...l.tracks };
      for (const key of PROP_KEYS) {
        const rest = (l.tracks[key] ?? []).filter((k) => Math.abs(k.time - t) >= 1e-3);
        tracks[key] = add
          ? [
              ...rest,
              { id: uid("k"), time: t, value: v[key], easing: "easyEase" as EasingName },
            ].sort((a, b) => a.time - b.time)
          : rest;
      }
      return { ...l, tracks };
    });
  };

  const editText = (id: string) => {
    const l = layers.find((x) => x.id === id);
    if (!l) return;
    const txt = window.prompt("Novo texto:", l.text ?? "");
    if (txt !== null) updateLayer(id, { text: txt });
  };

  const trackCamera = async () => {
    if (!background.video) return;
    setTracking(0);
    try {
      const motion = await analyzeCameraMotion(background.video, duration, setTracking);
      setCameraMotion(motion);
    } catch (error) {
      console.error("Falha na análise de câmera", error);
      alert("Não foi possível analisar o movimento deste vídeo.");
    } finally {
      setTracking(null);
    }
  };

  const detectTerrain = async () => {
    if (!background.video) return;
    try {
      setTerrainPoints(await analyzeTerrain(background.video));
    } catch (error) {
      console.error("Falha na análise de terreno", error);
      alert("Não foi possível detectar o terreno deste vídeo.");
    }
  };

  const pickTerrain = (point: TerrainPoint) => {
    if (!selected || !(selected.kind === "model3d" || (selected.kind === "text" && selected.text3d))) {
      alert("Selecione um objeto 3D ou texto 3D para posicionar no terreno.");
      return;
    }
    setValue(selected.id, "x", Math.round(point.x * 1280 - 640));
    setValue(selected.id, "y", Math.round(point.y * 720 - 360));
    setValue(selected.id, "rotZ", Math.round(point.tilt));
    updateLayer(selected.id, { followCamera: true });
  };

  // Bakes tracked camera motion + terrain tilt into real keyframes (x, y, rotX, rotY, rotZ).
  const bakeKeyframes = (layerId: string, step = 0.25) => {
    if (!cameraMotion) {
      alert("Clique em \"Rastrear câmera\" primeiro (barra abaixo do topo, com o vídeo de fundo).");
      return;
    }
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== layerId) return layer;
        const tracks = { ...layer.tracks };
        const keys: Record<"x" | "y" | "rotX" | "rotY" | "rotZ", { time: number; value: number }[]> =
          { x: [], y: [], rotX: [], rotY: [], rotZ: [] };
        for (let t = 0; t <= duration + 1e-6; t += step) {
          const time = Math.min(duration, Math.round(t * 1000) / 1000);
          const v = sampleLayer({ ...layer, followCamera: false }, time);
          const off = cameraOffsetAt(cameraMotion, time);
          const x = v.x + off.x;
          const y = v.y + off.y;
          keys.x.push({ time, value: Math.round(x) });
          keys.y.push({ time, value: Math.round(y) });
          const view = cameraViewAt(cameraMotion, time);
          keys.rotX.push({ time, value: Math.round(v.rotX + view.x) });
          keys.rotY.push({ time, value: Math.round(v.rotY + view.y) });
          let rotZ = v.rotZ;
          if (terrainPoints.length) {
            const sx = (x - off.x + 640) / 1280;
            const near = terrainPoints.reduce((a, b) => (Math.abs(b.x - sx) < Math.abs(a.x - sx) ? b : a));
            rotZ = near.tilt;
          }
          keys.rotZ.push({ time, value: Math.round(rotZ) });
        }
        for (const k of Object.keys(keys) as (keyof typeof keys)[]) {
          tracks[k] = keys[k].map((kf) => ({
            id: Math.random().toString(36).slice(2, 10),
            time: kf.time,
            value: kf.value,
            easing: "linear" as const,
          }));
        }
        // Motion is now baked, so stop the live offset to avoid applying it twice.
        return { ...layer, tracks, followCamera: false, cameraAngle: false };
      }),
    );
  };

  const exportMp4 = async () => {
    setPlaying(false);
    setExporting(0);
    try {
      const { blob, ext } = await exportVideo({
        layers,
        duration,
        fps,
        width: 1280,
        height: 720,
        background,
        cameraMotion,
        onProgress: setExporting,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `animacao.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (ext !== "mp4")
        alert("Seu navegador não grava MP4; o vídeo foi salvo em WebM. Use o Chrome/Edge atualizado para MP4.");
    } catch (e) {
      alert("Falha ao exportar: " + String(e));
    } finally {
      setExporting(null);
    }
  };

  const exportProject = () => {
    const blob = new Blob(
      [JSON.stringify({ fps, duration, layers, background: { ...background, video: undefined }, cameraMotion }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "projeto-motion.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data.layers)) {
          setLayers(
            data.layers.map((layer: Layer) => ({
              ...layer,
              base: Object.assign(
                {},
                createLayer(layer.kind, 0).base,
                {
                  blur: layer.effects?.blur ?? 0,
                  glow: layer.effects?.glow ?? 0,
                  shadow: layer.effects?.shadow ?? 0,
                  rotX: layer.rotX ?? 0,
                  rotY: layer.rotY ?? 0,
                  rotZ: layer.rotZ ?? 0,
                },
                layer.base,
              ),
              tracks: { ...createLayer(layer.kind, 0).tracks, ...layer.tracks },
            })),
          );
        }
        if (data.fps) setFps(data.fps);
        if (data.duration) setDuration(data.duration);
        if (data.background) setBackground(data.background);
        setCameraMotion(data.cameraMotion ?? null);
        setTerrainPoints(null);
        setTime(0);
      } catch {
        /* arquivo inválido */
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-panel px-4 py-2">
        <h1 className="font-display text-sm font-bold tracking-tight">
          Fluxo <span className="text-primary">Motion</span>
        </h1>
        <span className="text-[11px] text-muted-foreground">
          Espaço: play · ← →: quadro a quadro
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Zoom
            <input
              type="range"
              min={30}
              max={120}
              value={zoom * 100}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
              className="w-24 accent-[var(--color-primary)]"
            />
          </label>
          <label className="tool-btn cursor-pointer">
            Abrir
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importProject(f);
                e.target.value = "";
              }}
            />
          </label>
          <label className="tool-btn flex cursor-pointer items-center gap-1">
            Fundo
            <input
              type="color"
              value={background.color}
              onChange={(e) =>
                setBackground((b) => ({ ...b, color: e.target.value }))
              }
              className="h-4 w-5 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
          <label className="tool-btn cursor-pointer">
            Imagem de fundo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const r = new FileReader();
                  r.onload = () =>
                    setBackground((b) => ({ ...b, image: String(r.result) }));
                  r.readAsDataURL(f);
                }
                e.target.value = "";
              }}
            />
          </label>
          <label className="tool-btn cursor-pointer">
            Vídeo de fundo
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                 if (f) {
                   setBackground((b) => ({ ...b, video: URL.createObjectURL(f) }));
                   setCameraMotion(null);
                   setTerrainPoints(null);
                 }
                e.target.value = "";
              }}
            />
          </label>
          {(background.image || background.video) && (
            <button
              className="tool-btn"
               onClick={() => {
                 setBackground((b) => ({ ...b, image: undefined, video: undefined }));
                 setCameraMotion(null);
                 setTerrainPoints(null);
               }}
            >
              Remover fundo
            </button>
          )}
          <button className="tool-btn" onClick={exportProject}>
            Salvar projeto
          </button>
          <button
            className="tool-btn"
            title="Exporta as camadas no tempo atual como modelo 3D (.glb)"
            onClick={() =>
              export3D(layers, time).catch((e) => alert("Falha: " + String(e)))
            }
          >
            Exportar 3D
          </button>
          <button
            className="tool-btn"
            disabled={exporting !== null}
            style={{ borderColor: "var(--color-primary)" }}
            onClick={exportMp4}
          >
            {exporting !== null
              ? `Exportando ${Math.round(exporting * 100)}%`
              : "Exportar MP4"}
          </button>
        </div>
      </header>

      {background.video && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-panel px-4 py-1.5 text-xs">
          <span className="text-muted-foreground">CGI</span>
          <button className="tool-btn" onClick={trackCamera} disabled={tracking !== null}>
            {tracking !== null ? `Analisando ${Math.round(tracking * 100)}%` : "Rastrear câmera"}
          </button>
          <button className="tool-btn" onClick={detectTerrain}>Detectar terreno</button>
          {cameraMotion && <span className="text-primary">Câmera analisada</span>}
          {terrainPoints && <button className="tool-btn" onClick={() => setTerrainPoints(null)}>Ocultar pontos</button>}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 border-r border-border bg-panel">
          <LayersPanel
            layers={layers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addLayer}
            onToggleVisible={(id) =>
              patchLayer(id, (l) => ({ ...l, visible: !l.visible }))
            }
            onDelete={(id) => {
              setLayers((ls) => ls.filter((l) => l.id !== id));
              setSelectedId((s) => (s === id ? null : s));
            }}
            onReorder={(id, dir) =>
              setLayers((ls) => {
                const i = ls.findIndex((l) => l.id === id);
                const j = i + dir;
                if (i < 0 || j < 0 || j >= ls.length) return ls;
                const copy = [...ls];
                const a = copy[i];
                const b = copy[j];
                if (!a || !b) return ls;
                copy[i] = b;
                copy[j] = a;
                return copy;
              })
            }
            onImportImage={importImage}
            onImportVideo={importVideo}
            onImport3D={import3D}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <CanvasStage
              layers={layers}
              time={time}
              zoom={zoom}
              width={1280}
              height={720}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={moveLayer}
              background={background}
              onEditText={editText}
              playing={playing}
              cameraMotion={cameraMotion}
              terrainPoints={terrainPoints}
              onPickTerrain={pickTerrain}
            />
          </div>
          <div className="h-72 shrink-0 border-t border-border">
            <Timeline
              layers={layers}
              selectedId={selectedId}
              time={time}
              duration={duration}
              fps={fps}
              playing={playing}
              loop={loop}
              onSelect={setSelectedId}
              onSeek={(t) => {
                setPlaying(false);
                setTime(t);
              }}
              onTogglePlay={() => setPlaying((p) => !p)}
              onStop={() => {
                setPlaying(false);
                setTime(0);
              }}
              onToggleLoop={() => setLoop((l) => !l)}
              onAddKeyframe={() => keyframeAll(true)}
              onDeleteKeyframe={() => keyframeAll(false)}
              onFps={setFps}
              onDuration={setDuration}
              onMoveKeyframe={(layerId, key, kfId, t) =>
                patchLayer(layerId, (l) => ({
                  ...l,
                  tracks: {
                    ...l.tracks,
                    [key]: (l.tracks[key] ?? [])
                      .map((k) => (k.id === kfId ? { ...k, time: t } : k))
                      .sort((a, b) => a.time - b.time),
                  },
                }))
              }
              onRemoveKeyframe={(layerId, key, kfId) =>
                patchLayer(layerId, (l) => ({
                  ...l,
                  tracks: {
                    ...l.tracks,
                    [key]: (l.tracks[key] ?? []).filter((k) => k.id !== kfId),
                  },
                }))
              }
            />
          </div>
        </main>

        <aside className="w-72 shrink-0 border-l border-border bg-panel">
          <Inspector
            layer={selected}
            time={time}
            onUpdateLayer={updateLayer}
            onSetValue={setValue}
            onToggleKeyframe={toggleKeyframe}
            onSetEasing={setEasing}
            onSplitImage={addImageLayer}
            onBakeKeyframes={bakeKeyframes}
            hasCameraMotion={!!cameraMotion}
          />
        </aside>
      </div>
    </div>
  );
}
