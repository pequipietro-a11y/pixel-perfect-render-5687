import { describe, expect, it } from "vitest";
import { createPuppetRig, puppetDeformer } from "./puppet";
import { sampleRigLayer } from "./rig";
import { createLayer } from "./motion";
import { dragImageTransform } from "./manipulation";

describe("marionete", () => {
  it("preserva a imagem na pose de repouso", () => {
    const p = puppetDeformer(createPuppetRig(300), 0)(30, 50);
    expect(p.x).toBeCloseTo(30);
    expect(p.y).toBeCloseTo(50);
  });
  it("deforma a ponta sem deslocar igualmente a outra extremidade", () => {
    const rig = createPuppetRig(300);
    const tip = rig.bones[2];
    if (!tip) throw new Error("Osso ausente");
    tip.tracks.x = [{ id: "a", time: 0, value: 0, easing: "linear" }, { id: "b", time: 1, value: 100, easing: "linear" }];
    const deform = puppetDeformer(rig, 1);
    expect(deform(0, 100).x).toBeGreaterThan(90);
    expect(deform(0, -100).x).toBeLessThan(1);
    expect(puppetDeformer(rig, 0.5)(0, 100).x).toBeCloseTo(deform(0, 100).x / 2, 1);
  });
  it("não aplica duas vezes a translação da raiz", () => {
    const layer = createLayer("image", 0);
    layer.rig = createPuppetRig(300);
    const root = layer.rig.bones[0];
    if (!root) throw new Error("Osso ausente");
    root.tracks.x = [{ id: "k", time: 0, value: 50, easing: "linear" }];
    expect(sampleRigLayer(layer, [layer], 0).x).toBe(0);
    expect(puppetDeformer(layer.rig, 0)(0, 0).x).toBeCloseTo(50);
  });
});
describe("mouse", () => {
  it("aumenta e diminui preservando proporções", () => {
    expect(dragImageTransform("scale", 100, 0, 200, 0, 0, 100, 80)).toEqual({ scaleX: 200, scaleY: 160 });
    expect(dragImageTransform("scale", 100, 0, 50, 0, 0, 100, 80)).toEqual({ scaleX: 50, scaleY: 40 });
  });
  it("gira noventa graus pelo mouse", () => {
    expect(dragImageTransform("rotate", 100, 0, 0, 100, 20, 100, 100).rotation).toBeCloseTo(110);
  });
});