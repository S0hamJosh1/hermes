"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
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
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-lg text-center gap-6">
        {/* Logo / wordmark */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl font-black tracking-tight">HERMES</span>
          <span className="text-sm text-white/40 uppercase tracking-widest font-medium">
            Training Operating System
          </span>
        </div>

        {/* Tagline */}
        <p className="text-white/60 text-base leading-relaxed max-w-sm">
          A deterministic, data-driven training OS for 5K, 10K, Half Marathon,
          and Marathon runners. No guessing. No AI coaches. Just the algorithm.
        </p>

        {/* Pillars */}
        <div className="grid grid-cols-3 gap-3 w-full mt-2">
          {[
            { label: "Observe", icon: "◎" },
            { label: "Verify", icon: "◈" },
            { label: "Adapt", icon: "◉" },
          ].map(({ label, icon }) => (
            <div
              key={label}
              className="border border-white/10 rounded-lg p-3 flex flex-col items-center gap-1"
            >
              <span className="text-xl text-white/50">{icon}</span>
              <span className="text-xs text-white/50 uppercase tracking-widest font-medium">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* CTA */}
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

        <p className="text-xs text-white/25">
          Free forever. Your data stays yours.
        </p>
      </div>
    </main>
  );
}
