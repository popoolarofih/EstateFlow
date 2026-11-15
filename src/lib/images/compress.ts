"use client";

/**
 * Resizes and re-encodes photos in the browser before upload: faster uploads on mobile data,
 * smaller storage, and EXIF metadata (including GPS location) is dropped. PDFs and anything that
 * cannot be decoded are returned unchanged; the server still validates every file.
 */
export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ALWAYS_REENCODE = new Set(["image/heic", "image/heif"]);

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File, { maxDimension = 1600, quality = 0.8 }: CompressOptions = {}): Promise<File> {
  if (!COMPRESSIBLE.has(file.type) || typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encoded = await encode(canvas, "image/webp", quality);
  const blob = encoded?.type === "image/webp" ? encoded : await encode(canvas, "image/jpeg", quality);
  if (!blob) return file;
  // Keep the original when re-encoding would not help (already small and not resized).
  if (blob.size >= file.size && scale === 1 && !ALWAYS_REENCODE.has(file.type)) return file;
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  const name = `${file.name.replace(/\.[^.]+$/, "") || "photo"}.${extension}`;
  return new File([blob], name, { type: blob.type, lastModified: Date.now() });
}

/** Compresses every image value of one FormData field, leaving other fields untouched. */
export async function compressFormImages(form: FormData, field: string, options?: CompressOptions): Promise<FormData> {
  const files = form.getAll(field).filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) return form;
  const compressed = await Promise.all(files.map((file) => compressImage(file, options)));
  form.delete(field);
  for (const file of compressed) form.append(field, file);
  return form;
}
