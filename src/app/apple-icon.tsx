import { ImageResponse } from "next/og";

/** iOS home screen icon (Safari ignores SVG favicons for this). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#101B35" }}>
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path d="M9 22V12.5L16 8l7 4.5V22h-4.5v-5h-5v5H9Z" fill="#11B8A6" />
          <circle cx="22.5" cy="21.5" r="3.5" fill="#F3B64B" />
        </svg>
      </div>
    ),
    size,
  );
}
