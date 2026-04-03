"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV_ITEMS } from "@/lib/navigation/app-nav";
import GlassPanel from "@/components/ui/GlassPanel";
import {
  DashboardIcon,
  CalendarIcon,
  RocketIcon,
  GlobeIcon,
  PaperPlaneIcon,
  TargetIcon,
  LightningBoltIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@radix-ui/react-icons";
import type { ReactNode } from "react";

type AppSidebarProps = {
  bootcampCompleted: boolean;
  bootcampProgressPct?: number | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
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

export default function AppSidebar({
  bootcampCompleted,
  bootcampProgressPct,
  collapsed,
  onToggleCollapse,
}: AppSidebarProps) {
  const pathname = usePathname();
  const progressPct = Math.round(Math.max(0, Math.min(100, bootcampProgressPct ?? 0)));

  return (
    <GlassPanel
      className={`hidden lg:flex lg:shrink-0 lg:flex-col transition-[width] duration-300 ${collapsed ? "lg:w-16 p-2" : "lg:w-60 p-3"}`}
    >
      {/* Sidebar header */}
      <div className={`flex items-center mb-3 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 px-1">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-orange-400/60 to-orange-500/20" />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
              Navigate
            </span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white/80"
        >
          {collapsed ? (
            <ChevronRightIcon className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Bootcamp progress (only when active + expanded) */}
      {!bootcampCompleted && !collapsed && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Bootcamp</p>
          <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-white/50 to-white/30 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-white/35">{progressPct}%</p>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex flex-col gap-0.5 ${collapsed ? "items-center" : ""}`}>
        {APP_NAV_ITEMS.filter((item) =>
          item.href !== "/onboarding/bootcamp" || !bootcampCompleted
        ).map((item) => {
          const blocked = Boolean(item.requiresBootcampComplete && !bootcampCompleted);
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={blocked ? "/onboarding/bootcamp" : item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-lg text-sm transition-all duration-150 ${
                collapsed
                  ? `h-10 w-10 justify-center ${
                      active
                        ? "bg-white/12 text-white border border-white/20"
                        : "text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent"
                    }`
                  : `gap-3 px-3 py-2 ${
                      active
                        ? "bg-white/10 text-white border border-white/15"
                        : "text-white/55 hover:text-white/85 hover:bg-white/5 border border-transparent"
                    }`
              }`}
            >
              <span className={`flex-shrink-0 ${active ? "text-white/90" : ""}`}>
                {ICON_MAP[item.iconKey]}
              </span>
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.href === "/onboarding/bootcamp" && !bootcampCompleted && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
                  Active
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom status indicator */}
      <div className="mt-auto pt-4">
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </span>
            <span className="text-[10px] text-white/35 uppercase tracking-widest">Online</span>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center" title="Systems Online">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </span>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
