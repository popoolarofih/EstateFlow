import { randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";

/**
 * Upload validation by content, not by the client declared type. Images are checked by magic
 * bytes and their pixel dimensions are read from the header.
 */
export type UploadKind = "image" | "evidence";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 8000;
const MIN_DIMENSION = 32;

export interface ValidatedUpload {
  bytes: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  extension: "jpg" | "png" | "webp" | "pdf";
}

function sniff(bytes: Buffer): ValidatedUpload["contentType"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

export function imageDimensions(bytes: Buffer, type: ValidatedUpload["contentType"]): { width: number; height: number } | null {
  if (type === "image/png" && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (type === "image/webp" && bytes.length >= 30) {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (type === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1]!;
      const length = bytes.readUInt16BE(offset + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      offset += 2 + length;
    }
  }
  return null;
}

export async function validateUpload(file: File, kind: UploadKind): Promise<ValidatedUpload> {
  const limit = kind === "evidence" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (file.size === 0) throw new AppError("validation_failed", `"${file.name}" is empty.`);
  if (file.size > limit) {
    throw new AppError("validation_failed", `"${file.name}" is over ${Math.round(limit / 1024 / 1024)} MB.`);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type || (kind === "image" && type === "application/pdf")) {
    throw new AppError(
      "validation_failed",
      kind === "image" ? `"${file.name}" must be a JPEG, PNG or WebP image.` : `"${file.name}" must be an image or a PDF.`,
    );
  }
  if (type !== "application/pdf") {
    if (bytes.length > MAX_IMAGE_BYTES) throw new AppError("validation_failed", `"${file.name}" is over 5 MB.`);
    const size = imageDimensions(bytes, type);
    if (!size || size.width < MIN_DIMENSION || size.height < MIN_DIMENSION || size.width > MAX_DIMENSION || size.height > MAX_DIMENSION) {
      throw new AppError("validation_failed", `"${file.name}" has unsupported image dimensions.`);
    }
  }
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as const)[type];
  return { bytes, contentType: type, extension };
}

export function newFileName(extension: string): string {
  return `${Date.now()}_${randomBytes(6).toString("hex")}.${extension}`;
}

/** Collects `File` entries from multipart form data under one field name. */
export function filesFrom(form: FormData, field: string, max: number): File[] {
  const files = form.getAll(field).filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > max) throw new AppError("validation_failed", `Attach at most ${max} files.`);
  return files;
}
