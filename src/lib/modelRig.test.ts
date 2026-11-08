import { describe, expect, it } from "vitest";
import { Bone, BufferGeometry, Float32BufferAttribute, Group, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from "three";
import { createModelPoseWriter, extractModelRig } from "./modelRig";

function fixture() {
  const root = new Bone(); root.name = "Joint";
  const child = new Bone(); child.name = "Joint"; child.position.y = 1;
  root.add(child);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 1, 0], 3));
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute([1, 0, 0, 0], 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute([1, 0, 0, 0], 4));
  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial());
  mesh.add(root); mesh.bind(new Skeleton([root, child]));
  const object = new Group(); object.add(mesh); object.updateMatrixWorld(true);
  return { object, mesh, child };
}

describe("native model skeleton", () => {
  it("preserves hierarchy and distinguishes duplicate bone names", () => {
    const rig = extractModelRig(fixture().object);
    expect(rig?.bones.map((b) => [b.id, b.parentId, b.base.y])).toEqual([
      ["native-bone:0", null, 0], ["native-bone:1", "native-bone:0", 1],
    ]);
  });
  it("deforms weighted vertices at interpolated keyframes without cumulative drift", () => {
    const { object, mesh } = fixture();
    const rig = extractModelRig(object);
    const child = rig?.bones[1];
    if (!child) throw new Error("missing native bone");
    child.tracks.x = [{ id: "a", time: 0, value: 0, easing: "linear" }, { id: "b", time: 1, value: 2, easing: "linear" }];
    const write = createModelPoseWriter(object);
    write(rig, 0.5);
    expect(mesh.getVertexPosition(0, new Vector3()).x).toBeCloseTo(1);
    write(rig, 1); write(rig, 1);
    expect(mesh.getVertexPosition(0, new Vector3()).x).toBeCloseTo(2);
    write(undefined, 0);
    expect(mesh.getVertexPosition(0, new Vector3()).x).toBeCloseTo(0);
  });
  it("applies rotation XYZ in local skeleton space", () => {
    const { object, child } = fixture();
    const rig = extractModelRig(object);
    const entry = rig?.bones[1];
    if (!entry) throw new Error("missing native bone");
    entry.tracks.rotZ = [{ id: "r", time: 0, value: 90, easing: "linear" }];
    createModelPoseWriter(object)(rig, 0);
    expect(child.rotation.z).toBeCloseTo(Math.PI / 2);
    expect(child.position.y).toBe(1);
  });
});