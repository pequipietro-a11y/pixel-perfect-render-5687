import { Matrix4, Vector3, Quaternion, Euler } from "three";
import { sampleLayer, sampleTrack, uid, type Keyframe, type Layer } from "./motion";

export const BONE_KEYS = ["x", "y", "z", "rotX", "rotY", "rotZ"] as const;
export type BoneKey = (typeof BONE_KEYS)[number];
export interface RigBone {
  id: string;
  name: string;
  parentId: string | null;
  sourceName?: string;
  length: number;
  base: Record<BoneKey, number>;
  tracks: Record<BoneKey, Keyframe[]>;
}
export interface Rig { mode: "2d" | "3d"; bones: RigBone[] }
export function createBone(parentId: string | null, index: number): RigBone {
  return { id: uid("bone"), name: `Osso ${index + 1}`, parentId, length: 80,
    base: { x: 0, y: parentId ? 80 : 0, z: 0, rotX: 0, rotY: 0, rotZ: 0 },
    tracks: { x: [], y: [], z: [], rotX: [], rotY: [], rotZ: [] } };
}
export function sampleBone(bone: RigBone, time: number) {
  return Object.fromEntries(BONE_KEYS.map(key => [key, sampleTrack(bone.tracks[key] ?? [], time, bone.base[key])])) as Record<BoneKey, number>;
}
const rad = Math.PI / 180;
function poseMatrix(v: Record<BoneKey, number>) {
  return new Matrix4().compose(new Vector3(v.x, v.y, v.z),
    new Quaternion().setFromEuler(new Euler(v.rotX * rad, v.rotY * rad, v.rotZ * rad, "XYZ")), new Vector3(1, 1, 1));
}
export function boneMatrix(rig: Rig, id: string, time: number | null, visited = new Set<string>()): Matrix4 {
  const bone = rig.bones.find(b => b.id === id);
  if (!bone || visited.has(id)) return new Matrix4();
  visited.add(id);
  const local = poseMatrix(time === null ? bone.base : sampleBone(bone, time));
  return bone.parentId ? boneMatrix(rig, bone.parentId, time, visited).multiply(local) : local;
}
/** Rigid cut-out skinning: bind-space delta shared by stage and recorded frames. */
export function sampleRigLayer(layer: Layer, layers: Layer[], time: number) {
  const v = sampleLayer(layer, time);
  const binding = layer.rigBinding;
  const owner = binding ? layers.find(l => l.id === binding.layerId) : undefined;
  if (!binding || !owner?.rig) return v;
  const bone = owner.rig.bones.find(b => b.id === binding.boneId);
  if (!bone || bone.sourceName) return v;
  const anchor = sampleLayer(owner, time);
  const delta = boneMatrix(owner.rig, bone.id, time).multiply(boneMatrix(owner.rig, bone.id, null).invert());
  const p = new Vector3(v.x - anchor.x, v.y - anchor.y, 0).applyMatrix4(delta);
  const q = new Quaternion();
  delta.decompose(new Vector3(), q, new Vector3());
  const e = new Euler().setFromQuaternion(q, "XYZ");
  return { ...v, x: anchor.x + p.x, y: anchor.y + p.y,
    rotX: v.rotX + e.x / rad, rotY: v.rotY + e.y / rad, rotZ: v.rotZ + e.z / rad };
}