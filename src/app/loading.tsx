"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import GradientBackdrop from "@/components/ui/GradientBackdrop";
import GlassPanel from "@/components/ui/GlassPanel";

const SHELL_PREFIXES = ["/dashboard", "/plan", "/roadmap", "/map", "/chat", "/health", "/onboarding"];

export default function Loading() {
  const pathname = usePathname();

  const inShell = useMemo(
    () => SHELL_PREFIXES.some((prefix) => pathname?.startsWith(prefix)),
    [pathname]
  );

  return (
    <main className="relative isolate min-h-screen overflow-hidden text-white">
      {!inShell ? <GradientBackdrop /> : null}

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <GlassPanel className="w-full max-w-md p-7 text-center animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            <p className="text-sm font-medium text-white/78">Loading Hermes OS...</p>
            <p className="text-xs uppercase tracking-[0.2em] text-white/35">
              Preparing workspace
            </p>
          </div>
        </GlassPanel>
      </div>
    </main>
  );
}
