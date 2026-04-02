"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV_ITEMS } from "@/lib/navigation/app-nav";
import {
  DashboardIcon,
  CalendarIcon,
  RocketIcon,
  GlobeIcon,
  ChatBubbleIcon,
  TargetIcon,
  LightningBoltIcon,
  CheckCircledIcon,
  ExitIcon,
} from "@radix-ui/react-icons";
import type { ReactNode } from "react";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  bootcampCompleted: boolean;
  bootcampProgressPct?: number | null;
  onLogout: () => Promise<void> | void;
  loggingOut?: boolean;
};

const ICON_MAP: Record<string, ReactNode> = {
  dashboard: <DashboardIcon className="w-4 h-4" />,
  calendar: <CalendarIcon className="w-4 h-4" />,
  rocket: <RocketIcon className="w-4 h-4" />,
  globe: <GlobeIcon className="w-4 h-4" />,
  chat: <ChatBubbleIcon className="w-4 h-4" />,
  target: <TargetIcon className="w-4 h-4" />,
  lightning: <LightningBoltIcon className="w-4 h-4" />,
};

const SYSTEMS = [
  "Strava OAuth & Sync",
  "Auto-Calibration",
  "Bootcamp Flow",
  "Plan Generation",
  "State Machine",
  "Safety Validator",
  "Auto-Repair",
  "Health Tracking",
  "Compliance",
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

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-[#020a18]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close menu"
      />
      <div className="absolute left-0 top-0 h-full w-72 border-r border-white/15 bg-[#030712]/85 backdrop-blur-2xl p-4 flex flex-col">
        <p className="text-xs tracking-[0.2em] uppercase text-white/50">Hermes</p>
        <p className="text-xl font-semibold text-white mt-1 mb-4">Menu</p>

        {!bootcampCompleted && (
          <div className="mb-4 rounded-xl border border-white/15 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-widest text-white/45">Bootcamp</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-white/50 to-white/30 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, bootcampProgressPct ?? 0))}%` }}
              />
            </div>
          </div>
        )}

        <nav className="space-y-1">
          {APP_NAV_ITEMS.filter((item) =>
            item.href !== "/onboarding/bootcamp" || !bootcampCompleted
          ).map((item) => {
            const blocked = Boolean(item.requiresBootcampComplete && !bootcampCompleted);
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={blocked ? "/onboarding/bootcamp" : item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-white/10 text-white border border-white/20"
                    : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <span className={active ? "text-white/80" : "text-white/50"}>
                  {ICON_MAP[item.iconKey]}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Systems status - always visible */}
        <div className="mt-auto pt-5">
          <div className="flex items-center gap-2.5 px-3 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            <span className="text-xs text-white/50 uppercase tracking-widest">Systems Online</span>
          </div>
          <div className="space-y-1 px-3">
            {SYSTEMS.map((name) => (
              <div key={name} className="flex items-center gap-2.5 text-[11px] text-white/35 py-0.5">
                <CheckCircledIcon className="w-3 h-3 text-green-400/60 flex-shrink-0" />
                {name}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => void onLogout()}
          disabled={loggingOut}
          className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
        >
          <ExitIcon className="w-3.5 h-3.5" />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
