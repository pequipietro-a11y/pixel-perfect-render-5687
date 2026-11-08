import { Bone, Euler, type Object3D } from "three";
import { createBone, sampleBone, type Rig } from "./rig";

function nativeBones(object: Object3D) {
  const bones: Bone[] = [];
  object.traverse((node) => { if (node instanceof Bone) bones.push(node); });
  return bones;
}

/** Stable traversal identifiers survive parsing the same local model again. */
export function extractModelRig(object: Object3D): Rig | undefined {
  const bones = nativeBones(object);
  if (!bones.length) return undefined;
  const ids = new Map(bones.map((bone, i) => [bone, `native-bone:${i}`]));
  return {
    mode: "3d",
    bones: bones.map((bone, i) => {
      const sourceName = `native-bone:${i}`;
      const parentId = bone.parent instanceof Bone ? ids.get(bone.parent) ?? null : null;
      const entry = createBone(parentId, i);
      const rotation = new Euler().setFromQuaternion(bone.quaternion, "XYZ");
      const degrees = 180 / Math.PI;
      return { ...entry, id: sourceName ?? entry.id, sourceName, name: bone.name || entry.name,
        base: { x: bone.position.x, y: bone.position.y, z: bone.position.z,
          rotX: rotation.x * degrees, rotY: rotation.y * degrees, rotZ: rotation.z * degrees } };
    }),
  };
}

/** Apply local skeleton poses without changing skin weights or inverse bind matrices. */
export function createModelPoseWriter(object: Object3D) {
  const bones = nativeBones(object);
  const rest = bones.map((bone) => ({ position: bone.position.clone(), quaternion: bone.quaternion.clone() }));
  return (rig: Rig | undefined, time: number) => {
    bones.forEach((bone, i) => {
      const original = rest[i];
      if (!original) return;
      bone.position.copy(original.position);
      bone.quaternion.copy(original.quaternion);
      const entry = rig?.bones.find((b) => b.sourceName === `native-bone:${i}` || b.sourceName === bone.name);
      if (!entry) return;
      const pose = sampleBone(entry, time);
      bone.position.set(pose.x, pose.y, pose.z);
      const radians = Math.PI / 180;
      bone.rotation.set(pose.rotX * radians, pose.rotY * radians, pose.rotZ * radians, "XYZ");
    });
    object.updateMatrixWorld(true);
    object.traverse((node) => {
      if ("isSkinnedMesh" in node && node.isSkinnedMesh && "skeleton" in node) {
        (node as import("three").SkinnedMesh).skeleton.update();
      }
    });
  };
}