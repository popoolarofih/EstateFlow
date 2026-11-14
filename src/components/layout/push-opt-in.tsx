"use client";

import { BellRinging } from "@/components/ui/icons";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api/client";
import { firebaseApp } from "@/lib/firebase/client";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** Optional web push registration. Hidden when push is not configured or not supported. */
export function PushOptIn() {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "pending" | "enabled" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!VAPID_KEY) return;
    void isSupported().then((value) => {
      setSupported(value);
      if (value && Notification.permission === "granted") setState("enabled");
    });
  }, []);

  if (!VAPID_KEY || !supported) return null;

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        icon={<BellRinging size={20} aria-hidden />}
        pending={state === "pending"}
        pendingLabel="Enabling…"
        disabled={state === "enabled"}
        onClick={async () => {
          setState("pending");
          setMessage(null);
          try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") throw new Error("Notifications are blocked in your browser settings.");
            const registration = await navigator.serviceWorker.register("/push-sw.js");
            const token = await getToken(getMessaging(firebaseApp()), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
            await api("/api/push-tokens", { json: { token } });
            setState("enabled");
          } catch (error) {
            setState("error");
            setMessage(error instanceof Error && !("code" in error) ? error.message : errorMessage(error));
          }
        }}
      >
        {state === "enabled" ? "Push notifications on" : "Turn on push notifications"}
      </Button>
      {message && <Notice tone="error">{message}</Notice>}
    </div>
  );
}
