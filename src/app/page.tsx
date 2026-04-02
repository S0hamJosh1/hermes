"use client";

import { useEffect, useState } from "react";

import GradientBackdrop from "@/components/ui/GradientBackdrop";
import GlassPanel from "@/components/ui/GlassPanel";

export default function Home() {

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for error params from OAuth callback
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      const messages: Record<string, string> = {
        access_denied: "You denied access to Strava. Connect to use Hermes.",
        missing_code: "Something went wrong with the Strava redirect.",
        invalid_state: "Security check failed. Please try again.",
        auth_failed: "Authentication failed. Please try again.",
        unauthenticated: "Please connect with Strava to continue.",
      };
      setError(messages[err] ?? "An error occurred. Please try again.");
    }
  }, []);

  return (
    <main className="relative isolate min-h-screen text-white">
      <GradientBackdrop />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <GlassPanel className="w-full max-w-2xl p-7 md:p-10 animate-fade-in">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl font-black tracking-tight">HERMES</span>
              <span className="text-sm text-white/40 uppercase tracking-widest font-medium">
                Training Operating System
              </span>
            </div>

            <p className="text-white/65 text-base leading-relaxed max-w-xl">
              A deterministic, data-driven training OS for 5K, 10K, Half Marathon,
              and Marathon runners. No guessing. No AI coaches. Just the algorithm.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-1">
              {[
                { label: "Observe", icon: "O" },
                { label: "Verify", icon: "V" },
                { label: "Adapt", icon: "A" },
              ].map(({ label, icon }) => (
                <div
                  key={label}
                  className="glass-card p-3.5 flex flex-col items-center gap-1.5"
                >
                  <span className="text-base font-semibold text-white/55">{icon}</span>
                  <span className="text-xs text-white/55 uppercase tracking-widest font-medium">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {error && (
              <div className="w-full rounded-lg border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <a
              href="/api/auth/strava"
              className="mt-2 flex items-center gap-3 rounded-xl bg-[#FC4C02] px-6 py-3 font-semibold text-white transition hover:bg-[#e04400] active:scale-95"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 fill-current"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Connect with Strava
            </a>

            <p className="text-xs text-white/30">Free forever. Your data stays yours.</p>
          </div>
        </GlassPanel>
      </div>
    </main>
  );
}
