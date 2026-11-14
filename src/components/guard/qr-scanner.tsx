"use client";

import { X } from "@/components/ui/icons";
import { useEffect, useRef, useState } from "react";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function qrScanningSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Camera QR scanner using the native BarcodeDetector API on supported devices. */
export function QrScanner({ onResult, onClose }: { onResult: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    async function start() {
      if (!detector) {
        setError("QR scanning is not supported on this device. Enter the code instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const scan = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) {
              stopped = true;
              onResult(codes[0].rawValue);
              return;
            }
          } catch {
            // Frames can fail while the camera warms up; keep scanning.
          }
          frame = window.requestAnimationFrame(scan);
        };
        frame = window.requestAnimationFrame(scan);
      } catch {
        setError("Camera access was blocked. Allow the camera or enter the code instead.");
      }
    }
    void start();
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Scan QR pass">
      <div className="flex items-center justify-between p-4">
        <p className="title-2 text-white">Point the camera at the QR pass</p>
        <button type="button" onClick={onClose} className="inline-flex size-12 items-center justify-center rounded-xl bg-white/10 text-white" aria-label="Close scanner">
          <X size={24} aria-hidden />
        </button>
      </div>
      {error ? (
        <p role="alert" className="m-4 rounded-xl bg-white/10 p-4 body-3 text-white">
          {error}
        </p>
      ) : (
        <video ref={videoRef} className="w-full flex-1 object-cover" playsInline muted aria-hidden />
      )}
    </div>
  );
}
