"use client";

import { BeamsBackground } from "@/components/ui/beams-background";

export default function GradientBackdrop() {
  return (
    <BeamsBackground
      intensity="strong"
      className="pointer-events-none fixed inset-0 -z-10 min-h-0"
    />
  );
}
