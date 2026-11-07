import { Vector3 } from "three";
import { boneMatrix, createBone, type Rig } from "./rig";

/** Linear blend skinning over a regular image lattice, using Three.js bind-space matrices. */
export function puppetDeformer(rig: Rig, time: number) {
  const bones = rig.bones.map((bone) => {
    const bind = boneMatrix(rig, bone.id, null);
    const anchor = new Vector3().setFromMatrixPosition(bind);
    const parent = bone.parentId ? new Vector3().setFromMatrixPosition(boneMatrix(rig, bone.parentId, null)) : anchor;
    return { anchor, parent, delta: boneMatrix(rig, bone.id, time).multiply(bind.clone().invert()) };
  });
  return (x: number, y: number): Vector3 => {
    const point = new Vector3(x, y, 0);
    const weighted = bones.map((bone) => {
      const line = bone.anchor.clone().sub(bone.parent);
      const t = line.lengthSq() ? Math.max(0, Math.min(1, point.clone().sub(bone.parent).dot(line) / line.lengthSq())) : 0;
      const nearest = bone.parent.clone().addScaledVector(line, t);
      return { ...bone, weight: 1 / Math.pow(Math.max(4, point.distanceTo(nearest)), 4) };
    }).sort((a, b) => b.weight - a.weight).slice(0, 4);
    const sum = weighted.reduce((s, b) => s + b.weight, 0);
    if (!sum) return point;
    return weighted.reduce((out, b) => out.addScaledVector(point.clone().applyMatrix4(b.delta), b.weight / sum), new Vector3());
  };
}

export function createPuppetRig(height: number): Rig {
  const root = createBone(null, 0);
  root.base.y = -height / 3;
  const middle = createBone(root.id, 1);
  middle.base.y = height / 3;
  const tip = createBone(middle.id, 2);
  tip.base.y = height / 3;
  return { mode: "2d", deform: true, bones: [root, middle, tip] };
}