"use client";

import { Printer } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button variant="secondary" icon={<Printer size={20} aria-hidden />} onClick={() => window.print()}>
      Print
    </Button>
  );
}
