"use client";

/**
 * Browser-side image downscaling (V3 §9.1, §9.2). Nothing leaves the device except the resized
 * schedule image sent to /api/schedule/parse. Output is a data URL small enough for the store.
 */
export interface ResizeOptions {
  /** longest edge in px */
  maxEdge: number;
  /** crop to a centered square (profile photos) */
  square?: boolean;
  /** stop lowering quality once the data URL is at most this many bytes */
  maxBytes: number;
}

export async function resizeImage(file: Blob, opts: ResizeOptions): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    let sx = 0;
    let sy = 0;
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (opts.square) {
      const side = Math.min(sw, sh);
      sx = Math.round((sw - side) / 2);
      sy = Math.round((sh - side) / 2);
      sw = sh = side;
    }
    const scale = Math.min(1, opts.maxEdge / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas isn't available in this browser.");
    ctx.fillStyle = "#fff"; // transparent PNGs become white, not black, as JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
    let out = "";
    for (const q of [0.86, 0.78, 0.68, 0.56, 0.45]) {
      out = canvas.toDataURL("image/jpeg", q);
      if (dataUrlBytes(out) <= opts.maxBytes) return out;
    }
    return out;
  } finally {
    bitmap.close();
  }
}

/** Decoded size of a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((b64.length * 3) / 4);
}
