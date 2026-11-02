import { useState } from "react";
import { snapToFrame, uid, type Layer } from "@/lib/motion";
import { BONE_KEYS, createBone, sampleBone, type BoneKey, type Rig, type RigBone } from "@/lib/rig";

interface Props {
  layers: Layer[];
  layer: Layer | null;
  time: number;
  fps: number;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
}

const LABELS: Record<BoneKey, string> = {
  x: "Posição X", y: "Posição Y", z: "Posição Z", rotX: "Giro X", rotY: "Giro Y", rotZ: "Giro Z",
};

function depth(rig: Rig, b: RigBone): number {
  let d = 0;
  let p = b.parentId;
  while (p && d < 20) { d++; p = rig.bones.find((x) => x.id === p)?.parentId ?? null; }
  return d;
}

export function RigPanel({ layers, layer, time, fps, onUpdateLayer }: Props) {
  const [boneId, setBoneId] = useState<string | null>(null);
  if (!layer) {
    return <p className="p-6 text-center text-xs text-muted-foreground">Selecione uma camada para animar com ossos.</p>;
  }
  const rig = layer.rig;
  const bone = rig?.bones.find((b) => b.id === boneId) ?? rig?.bones[0] ?? null;
  const setRig = (r: Rig | undefined) => onUpdateLayer(layer.id, { rig: r });
  const patchBone = (fn: (b: RigBone) => RigBone) =>
    rig && bone && setRig({ ...rig, bones: rig.bones.map((b) => (b.id === bone.id ? fn(b) : b)) });
  const keys = rig?.mode === "2d" ? (["x", "y", "rotZ"] as BoneKey[]) : [...BONE_KEYS];
  const t = snapToFrame(time, fps);
  const pose = bone ? sampleBone(bone, time) : null;

  const setVal = (k: BoneKey, value: number) =>
    patchBone((b) => {
      const tr = b.tracks[k];
      if (!tr.length) return { ...b, base: { ...b.base, [k]: value } };
      const ex = tr.find((x) => Math.abs(x.time - t) < 1e-3);
      const next = ex ? tr.map((x) => (x.id === ex.id ? { ...x, value } : x))
        : [...tr, { id: uid("k"), time: t, value, easing: "easyEase" as const }].sort((a, b2) => a.time - b2.time);
      return { ...b, tracks: { ...b.tracks, [k]: next } };
    });
  const toggleKey = (k: BoneKey) =>
    patchBone((b) => {
      const tr = b.tracks[k];
      const ex = tr.find((x) => Math.abs(x.time - t) < 1e-3);
      const next = ex ? tr.filter((x) => x.id !== ex.id)
        : [...tr, { id: uid("k"), time: t, value: sampleBone(b, time)[k], easing: "easyEase" as const }].sort((a, b2) => a.time - b2.time);
      return { ...b, tracks: { ...b.tracks, [k]: next } };
    });

  const owners = layers.filter((l) => l.rig && l.id !== layer.id);

  return (
    <div className="flex flex-col gap-4 p-3 text-xs">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Esqueleto (rig)</h2>
        {!rig ? (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button className="tool-btn" onClick={() => { const b = createBone(null, 0); setBoneId(b.id); setRig({ mode: "2d", bones: [b] }); }}>Criar rig 2D</button>
            <button className="tool-btn" onClick={() => { const b = createBone(null, 0); setBoneId(b.id); setRig({ mode: "3d", bones: [b] }); }}>Criar rig 3D</button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-muted-foreground">Modo {rig.mode.toUpperCase()} · {rig.bones.length} osso(s)</p>
            <div className="mt-2 space-y-1">
              {rig.bones.map((b) => (
                <button key={b.id} onClick={() => setBoneId(b.id)}
                  className={`block w-full rounded border px-2 py-1 text-left ${b.id === bone?.id ? "border-primary bg-panel-raised" : "border-border"}`}
                  style={{ paddingLeft: 8 + depth(rig, b) * 12 }}>
                  🦴 {b.name}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button className="tool-btn" onClick={() => { const b = createBone(bone?.id ?? null, rig.bones.length); setBoneId(b.id); setRig({ ...rig, bones: [...rig.bones, b] }); }}>+ Osso filho</button>
              <button className="tool-btn" disabled={!bone} onClick={() => {
                if (!bone) return;
                const kill = new Set([bone.id]);
                let grew = true;
                while (grew) { grew = false; for (const b of rig.bones) if (b.parentId && kill.has(b.parentId) && !kill.has(b.id)) { kill.add(b.id); grew = true; } }
                const rest = rig.bones.filter((b) => !kill.has(b.id));
                setBoneId(null);
                setRig(rest.length ? { ...rig, bones: rest } : undefined);
              }}>Remover osso</button>
            </div>
          </>
        )}
      </section>

      {rig && bone && pose && (
        <section className="space-y-1.5">
          <input className="num-field font-sans text-sm" value={bone.name} onChange={(e) => patchBone((b) => ({ ...b, name: e.target.value }))} />
          {keys.map((k) => {
            const atKey = bone.tracks[k].some((x) => Math.abs(x.time - t) < 1e-3);
            return (
              <div key={k} className="flex items-center gap-2">
                <button onClick={() => toggleKey(k)} title="Keyframe neste tempo" className="grid h-5 w-5 place-items-center">
                  <span className={`block h-2.5 w-2.5 rotate-45 border ${atKey ? "border-primary bg-primary" : bone.tracks[k].length ? "border-primary" : "border-muted-foreground"}`} />
                </button>
                <span className="flex-1 text-muted-foreground">{LABELS[k]}</span>
                <input type="number" className="num-field w-20" value={Math.round(pose[k] * 10) / 10}
                  onChange={(e) => setVal(k, Number(e.target.value))} />
              </div>
            );
          })}
          <p className="text-muted-foreground">Clique no losango para gravar um keyframe do osso no tempo atual. Camadas vinculadas a este osso se movem junto.</p>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vincular a um osso</h2>
        <select className="num-field mt-2 font-sans"
          value={layer.rigBinding ? `${layer.rigBinding.layerId}|${layer.rigBinding.boneId}` : ""}
          onChange={(e) => {
            const [layerId, bId] = e.target.value.split("|");
            onUpdateLayer(layer.id, { rigBinding: layerId && bId ? { layerId, boneId: bId } : undefined });
          }}>
          <option value="">Nenhum</option>
          {owners.flatMap((o) => o.rig!.bones.map((b) => (
            <option key={o.id + b.id} value={`${o.id}|${b.id}`}>{o.name} → {b.name}</option>
          )))}
        </select>
        {!owners.length && <p className="mt-1 text-muted-foreground">Crie um rig em outra camada para vincular esta a ele.</p>}
      </section>
    </div>
  );
}
