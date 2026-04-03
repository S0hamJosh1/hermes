"use client";

import { useEffect, useState } from "react";
import GradientBackdrop from "@/components/ui/GradientBackdrop";

const FEATURES = [
  "Adaptive plans built from your Strava history",
  "State-machine intelligence, not AI guesswork",
  "Auto-calibrated pacing and volume targets",
];

export default function Home() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    <main className="relative min-h-screen text-white">
      <GradientBackdrop />

      <div className="relative z-10 flex min-h-screen">
        {/* ── Left: Brand ── */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 xl:px-24">
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-orange-400 to-orange-600" />
              <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-white/50">
                Training OS
              </span>
            </div>

            <h1 className="text-6xl xl:text-7xl font-black tracking-tight leading-[0.95]">
              HERMES
            </h1>

            <p className="mt-6 text-lg text-white/50 leading-relaxed max-w-md">
              Deterministic training for distance runners.
              No coaches. No guesswork. Just data.
            </p>

            <div className="mt-10 flex flex-col gap-3">
              {FEATURES.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <div className="mt-1.5 w-1 h-1 rounded-full bg-orange-400/60 shrink-0" />
                  <span className="text-sm text-white/35">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Login ── */}
        <div className="flex-1 flex items-center justify-center px-6 py-16 lg:px-16">
          <div className="w-full max-w-sm animate-fade-in">
            {/* Mobile-only brand */}
            <div className="lg:hidden mb-10 text-center">
              <h1 className="text-4xl font-black tracking-tight">HERMES</h1>
              <p className="mt-2 text-sm text-white/40 tracking-wide">
                Training OS for distance runners
              </p>
            </div>

            <div className="glass-panel p-8">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/35 mb-1">
                Get started
              </p>
              <h2 className="text-xl font-semibold tracking-tight mb-6">
                Sign in to your workspace
              </h2>

              {error && (
                <div className="mb-5 rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <a
                href="/api/auth/strava"
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FC4C02] px-5 py-3.5 font-semibold text-white transition hover:bg-[#e04400] active:scale-[0.98]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Continue with Strava
              </a>

              <p className="mt-5 text-center text-[11px] text-white/25 leading-relaxed">
                Free and open source. Your data stays on your account.
              </p>
            </div>

            {/* Mobile features */}
            <div className="lg:hidden mt-8 flex flex-col gap-2.5 px-1">
              {FEATURES.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <div className="mt-1.5 w-1 h-1 rounded-full bg-orange-400/50 shrink-0" />
                  <span className="text-xs text-white/30">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
