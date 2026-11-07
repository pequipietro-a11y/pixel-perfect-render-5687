export function dragImageTransform(mode: "rotate" | "scale", startX: number, startY: number, x: number, y: number, rotation: number, scaleX: number, scaleY: number) {
  if (mode === "rotate") {
    const angle = Math.atan2(y, x) - Math.atan2(startY, startX);
    return { rotation: rotation + Math.atan2(Math.sin(angle), Math.cos(angle)) * 180 / Math.PI };
  }
  const ratio = Math.max(0.02, Math.hypot(x, y) / Math.max(1, Math.hypot(startX, startY)));
  return { scaleX: scaleX * ratio, scaleY: scaleY * ratio };
}