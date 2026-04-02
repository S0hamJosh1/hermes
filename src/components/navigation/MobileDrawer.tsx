"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV_ITEMS } from "@/lib/navigation/app-nav";
import { Cross1Icon } from "@radix-ui/react-icons";
import {
  DashboardIcon,
  CalendarIcon,
  RocketIcon,
  GlobeIcon,
  PaperPlaneIcon,
  TargetIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import type { ReactNode } from "react";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  currentLabel: string;
  bootcampCompleted: boolean;
  bootcampProgressPct?: number | null;
};

const ICON_MAP: Record<string, ReactNode> = {
  dashboard: <DashboardIcon className="w-4 h-4" />,
  calendar: <CalendarIcon className="w-4 h-4" />,
  rocket: <RocketIcon className="w-4 h-4" />,
  globe: <GlobeIcon className="w-4 h-4" />,
  chat: <PaperPlaneIcon className="w-4 h-4" />,
  target: <TargetIcon className="w-4 h-4" />,
  lightning: <LightningBoltIcon className="w-4 h-4" />,
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileDrawer({
  open,
  onClose,
  currentLabel,
  bootcampCompleted,
  bootcampProgressPct,
}: MobileDrawerProps) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close menu"
      />
      <div className="absolute left-0 top-0 h-full w-72 border-r border-white/10 bg-[#060a12]/95 backdrop-blur-2xl p-4 flex flex-col animate-fade-in">
        {/* Drawer header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-white/40">Navigate</p>
            <p className="text-sm font-medium text-white/80 mt-0.5">{currentLabel}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white/80 hover:bg-white/10 transition"
          >
            <Cross1Icon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bootcamp progress */}
        {!bootcampCompleted && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Bootcamp</p>
            <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-white/50 to-white/30 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, bootcampProgressPct ?? 0))}%` }}
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5">
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-white/10 text-white border border-white/15"
                    : "text-white/55 hover:text-white/85 hover:bg-white/5 border border-transparent"
                }`}
              >
                <span className={`flex-shrink-0 ${active ? "text-white/90" : ""}`}>
                  {ICON_MAP[item.iconKey]}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom status */}
        <div className="mt-auto pt-5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </span>
            <span className="text-[10px] text-white/35 uppercase tracking-widest">Systems Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
