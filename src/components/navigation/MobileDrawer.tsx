"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV_ITEMS } from "@/lib/navigation/app-nav";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  bootcampCompleted: boolean;
  bootcampProgressPct?: number | null;
  onLogout: () => Promise<void> | void;
  loggingOut?: boolean;
};

const SYSTEMS = [
  "Strava OAuth & Sync",
  "Auto-Calibration",
  "Bootcamp Flow",
  "Plan Generation Pipeline",
  "State Machine (9 states)",
  "Validator (8 safety rules)",
  "Auto-Repair Engine",
  "Health & Injury Tracking",
  "Compliance System",
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileDrawer({
  open,
  onClose,
  bootcampCompleted,
  bootcampProgressPct,
  onLogout,
  loggingOut = false,
}: MobileDrawerProps) {
  const pathname = usePathname();
  const [systemsExpanded, setSystemsExpanded] = useState(false);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-[#020a18]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close menu"
      />
      <div className="absolute left-0 top-0 h-full w-72 border-r border-blue-400/15 bg-[#030e24]/80 backdrop-blur-2xl p-4 flex flex-col">
        <p className="text-xs tracking-[0.2em] uppercase text-blue-300/60">Hermes</p>
        <p className="text-xl font-semibold text-white mt-1 mb-4">Menu</p>

        {!bootcampCompleted && (
          <div className="mb-4 rounded-xl border border-blue-400/15 bg-blue-500/5 p-3">
            <p className="text-xs uppercase tracking-widest text-blue-300/50">Bootcamp</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, bootcampProgressPct ?? 0))}%` }}
              />
            </div>
          </div>
        )}

        <nav className="space-y-1 flex-1">
          {APP_NAV_ITEMS.map((item) => {
            const blocked = Boolean(item.requiresBootcampComplete && !bootcampCompleted);
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={blocked ? "/onboarding/bootcamp" : item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-blue-500/15 text-white border border-blue-400/25"
                    : "text-white/70 hover:text-white hover:bg-blue-500/10 border border-transparent"
                }`}
              >
                <span className={active ? "text-blue-300" : "text-white/50"}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Systems status */}
        <div className="mb-3">
          <button
            onClick={() => setSystemsExpanded((v) => !v)}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-white/50 hover:text-white/70 transition"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            <span>All Systems Online</span>
            <svg
              className={`ml-auto h-3 w-3 transition-transform ${systemsExpanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {systemsExpanded && (
            <div className="mt-1 ml-3 pl-4 border-l border-blue-400/10 space-y-1">
              {SYSTEMS.map((name) => (
                <div key={name} className="flex items-center gap-2 text-[11px] text-white/40 py-0.5">
                  <span className="w-1 h-1 rounded-full bg-green-400 flex-shrink-0" />
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => void onLogout()}
          disabled={loggingOut}
          className="rounded-xl border border-blue-400/15 bg-blue-500/5 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-blue-500/10 transition disabled:opacity-50"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
