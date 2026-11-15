"use client";

import { SignOut } from "@/components/ui/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOutEverywhere } from "@/lib/auth/client-session";

export function SignOutButton({ variant = "secondary", className }: { variant?: "secondary" | "ghost"; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant={variant}
      className={className}
      pending={pending}
      pendingLabel="Signing out…"
      icon={<SignOut size={20} aria-hidden />}
      onClick={async () => {
        setPending(true);
        await signOutEverywhere().catch(() => undefined);
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
