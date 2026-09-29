export interface PixelPoint {
  x: number;
  y: number;
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function imageCanvas(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas indisponível");
  context.drawImage(image, 0, 0);
  return { canvas, context };
}

function colorDistance(data: Uint8ClampedArray, offset: number, color: [number, number, number]) {
  const dr = (data[offset] ?? 0) - color[0];
  const dg = (data[offset + 1] ?? 0) - color[1];
  const db = (data[offset + 2] ?? 0) - color[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const parsed = Number.parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

/** Removes a selected color and leaves a small soft edge around the subject. */
export async function chromaKeyImage(src: string, keyColor: string, tolerance: number) {
  const image = await loadCanvasImage(src);
  const { canvas, context } = imageCanvas(image);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const key = hexToRgb(keyColor);
  const hardLimit = Math.max(1, tolerance * 2.2);
  const softLimit = hardLimit + 28;

  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const distance = colorDistance(pixels.data, offset, key);
    if (distance <= hardLimit) pixels.data[offset + 3] = 0;
    else if (distance < softLimit) {
      const currentAlpha = pixels.data[offset + 3] ?? 255;
      pixels.data[offset + 3] = Math.round(currentAlpha * ((distance - hardLimit) / 28));
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

/** Keeps genuine PNG transparency; otherwise clears only background connected to the image edges. */
export async function removeConnectedPngBackground(src: string) {
  const image = await loadCanvasImage(src);
  const { canvas, context } = imageCanvas(image);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let offset = 3; offset < pixels.data.length; offset += 4) {
    if ((pixels.data[offset] ?? 255) < 250) return src;
  }

  const width = canvas.width;
  const height = canvas.height;
  const corners = [0, (width - 1) * 4, (height - 1) * width * 4, (height * width - 1) * 4];
  const background: [number, number, number] = [0, 0, 0];
  for (const offset of corners) {
    background[0] += (pixels.data[offset] ?? 0) / corners.length;
    background[1] += (pixels.data[offset + 1] ?? 0) / corners.length;
    background[2] += (pixels.data[offset + 2] ?? 0) / corners.length;
  }

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  for (let x = 0; x < width; x++) queue.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) queue.push(y * width, y * width + width - 1);
  let cursor = 0;
  const threshold = 42;
  while (cursor < queue.length) {
    const index = queue[cursor++];
    if (index === undefined || visited[index]) continue;
    visited[index] = 1;
    if (colorDistance(pixels.data, index * 4, background) > threshold) continue;
    pixels.data[index * 4 + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) queue.push(index - 1);
    if (x + 1 < width) queue.push(index + 1);
    if (y > 0) queue.push(index - width);
    if (y + 1 < height) queue.push(index + width);
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

export function tracePolygon(context: CanvasRenderingContext2D, points: PixelPoint[]) {
  const first = points[0];
  if (!first) return false;
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  return true;
}