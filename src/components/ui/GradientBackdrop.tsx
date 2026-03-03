"use client";

import Image from "next/image";

export default function GradientBackdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <Image
        src="/bg-waves.png"
        alt=""
        fill
        priority
        className="object-cover"
        quality={90}
      />
      <div className="absolute inset-0 bg-[#020a18]/40" />
    </div>
  );
}
