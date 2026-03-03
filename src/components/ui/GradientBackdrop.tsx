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
        sizes="100vw"
        quality={92}
        className="object-cover object-[center_35%] md:object-[center_42%] lg:object-[center_45%]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_-10%,rgba(50,120,255,0.14),transparent),radial-gradient(900px_500px_at_80%_120%,rgba(255,255,255,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.26),rgba(0,0,0,0.16)_25%,rgba(0,0,0,0.16)_75%,rgba(0,0,0,0.3))]" />
      <div className="absolute inset-0 bg-[#020a18]/14" />
    </div>
  );
}
