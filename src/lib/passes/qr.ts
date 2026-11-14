import { z } from "zod";

/**
 * QR payload (blueprint section 9). The token is an opaque bearer credential; it carries no
 * resident personal data and never contains the six digit code.
 */
export const qrPayloadSchema = z.object({
  v: z.literal(1),
  passId: z.string().min(10).max(64),
  estateId: z.string().min(1).max(64),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export type QrPayload = z.infer<typeof qrPayloadSchema>;

export function encodeQrPayload(payload: QrPayload): string {
  return JSON.stringify(payload);
}

export function decodeQrPayload(raw: string): QrPayload | null {
  try {
    const parsed = qrPayloadSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
