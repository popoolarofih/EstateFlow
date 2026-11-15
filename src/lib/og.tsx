import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Shared 1200x630 social card used for Open Graph and X (Twitter). */
export const SOCIAL_IMAGE = {
  alt: "EstateFlow: every visitor verified, every naira accounted for",
  size: { width: 1200, height: 630 },
  contentType: "image/png",
} as const;

export async function renderSocialImage(): Promise<ImageResponse> {
  // Satori needs ttf, otf or woff (not woff2).
  const font = await readFile(join(process.cwd(), "src/app/fonts/manrope-latin-700-normal.woff"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F4F7FB", padding: 80, fontFamily: "Manrope" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, color: "#101B35" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#101B35", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: "#F3B64B" }} />
          </div>
          EstateFlow
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 72, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#101B35" }}>
          <span>Every visitor verified.</span>
          <span>Every naira accounted for.</span>
        </div>
        <div style={{ fontSize: 28, color: "#566079" }}>Visitor passes, verified dues payments and a ledger for Nigerian estates.</div>
      </div>
    ),
    { ...SOCIAL_IMAGE.size, fonts: [{ name: "Manrope", data: font, weight: 700, style: "normal" }] },
  );
}
