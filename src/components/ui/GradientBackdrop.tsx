"use client";

import { BeamsBackground } from "@/components/ui/beams-background";

export default function GradientBackdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <BeamsBackground
        intensity="medium"
        className="!min-h-0 h-full"
      />
    </div>
  );
}
