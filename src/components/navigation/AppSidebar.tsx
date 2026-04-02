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
  ExitIcon,
  HamburgerMenuIcon,
} from "@radix-ui/react-icons";
import type { ReactNode } from "react";

type AppSidebarProps = {
  username?: string;
  bootcampCompleted: boolean;
  bootcampProgressPct?: number | null;
  onLogout: () => Promise<void> | void;
  loggingOut?: boolean;
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
  username,
  bootcampCompleted,
  bootcampProgressPct,
  onLogout,
  loggingOut = false,
  collapsed,
  onToggleCollapse,
}: AppSidebarProps) {
  const pathname = usePathname();
  const progressPct = Math.round(Math.max(0, Math.min(100, bootcampProgressPct ?? 0)));

  return (
    <GlassPanel
      className={`hidden lg:flex lg:shrink-0 lg:flex-col p-4 transition-[width] duration-300 ${collapsed ? "lg:w-20" : "lg:w-72"}`}
    >
      <div className={`mb-6 ${collapsed ? "px-0" : "px-2"}`}>
        <div className={`flex gap-2 ${collapsed ? "justify-center" : "items-start justify-between"}`}>
          {!collapsed ? (
            <div>
              <p className="text-xs tracking-[0.2em] uppercase text-white/50">Hermes</p>
              <p className="text-2xl font-semibold text-white mt-1">Training OS</p>
            </div>
          ) : null}
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-xl border border-white/15 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <HamburgerMenuIcon className="h-4 w-4" />
          </button>
        </div>

        {!collapsed && username ? <p className="text-xs text-white/40 mt-2">@{username}</p> : null}
      </div>

      {!bootcampCompleted && !collapsed && (
        <div className="mb-5 rounded-xl border border-white/15 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-widest text-white/45">Bootcamp</p>
          <p className="text-sm text-white/80 mt-1">Calibration in progress</p>
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-white/50 to-white/30 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            {progressPct}% complete
          </p>
        </div>
      )}

      <nav className={`space-y-1 ${collapsed ? "flex flex-col items-center" : ""}`}>
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
              className={`flex items-center rounded-xl text-sm transition ${collapsed
                  ? `h-12 w-12 justify-center px-0 ${active
                    ? "bg-white/10 text-white border border-white/20"
                    : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"}`
                  : `${active
                    ? "bg-white/10 text-white border border-white/20"
                    : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"} gap-3 px-3 py-2.5`
                }`}
            >
              <span className={active ? "text-white/80" : "text-white/50"}>
                {ICON_MAP[item.iconKey]}
              </span>
              {!collapsed ? <span>{item.label}</span> : null}
              {!collapsed && item.href === "/onboarding/bootcamp" && !bootcampCompleted ? (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white/60">
                  Active
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-5">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => void onLogout()}
              disabled={loggingOut}
              title={loggingOut ? "Logging out..." : "Logout"}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
            >
              <ExitIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 px-3 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              <span className="text-xs text-white/50 uppercase tracking-widest">Systems Online</span>
            </div>
          </>
        )}
      </div>

      {!collapsed ? (
        <button
          onClick={() => void onLogout()}
          disabled={loggingOut}
          className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
        >
          <ExitIcon className="w-3.5 h-3.5" />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      ) : null}
    </GlassPanel>
  );
}
