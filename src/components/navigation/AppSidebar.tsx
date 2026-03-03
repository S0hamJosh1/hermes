"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV_ITEMS } from "@/lib/navigation/app-nav";
import GlassPanel from "@/components/ui/GlassPanel";

type AppSidebarProps = {
  username?: string;
  bootcampCompleted: boolean;
  bootcampProgressPct?: number | null;
  onLogout: () => Promise<void> | void;
  loggingOut?: boolean;
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
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <GlassPanel className="hidden lg:flex lg:w-72 lg:shrink-0 lg:flex-col p-4 h-[calc(100vh-2rem)] sticky top-4">
      <div className="mb-6 px-2">
        <p className="text-xs tracking-[0.2em] uppercase text-white/50">Hermes</p>
        <p className="text-2xl font-semibold text-white mt-1">Training OS</p>
        {username ? <p className="text-xs text-white/50 mt-2">@{username}</p> : null}
      </div>

      {!bootcampCompleted && (
        <div className="mb-5 rounded-xl border border-white/15 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-widest text-white/50">Bootcamp</p>
          <p className="text-sm text-white/80 mt-1">Calibration in progress</p>
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, bootcampProgressPct ?? 0))}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-white/50">
            {Math.round(Math.max(0, Math.min(100, bootcampProgressPct ?? 0)))}% complete
          </p>
        </div>
      )}

      <nav className="flex-1 space-y-1">
        {APP_NAV_ITEMS.map((item) => {
          const blocked = Boolean(item.requiresBootcampComplete && !bootcampCompleted);
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={blocked ? "/onboarding/bootcamp" : item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-white/15 text-white border border-white/20"
                  : "text-white/70 hover:text-white hover:bg-white/10 border border-transparent"
              }`}
            >
              <span className="text-white/70">{item.icon}</span>
              <span>{item.label}</span>
              {item.href === "/onboarding/bootcamp" && !bootcampCompleted ? (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/30 text-fuchsia-200">
                  Active
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => void onLogout()}
        disabled={loggingOut}
        className="mt-4 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
      >
        {loggingOut ? "Logging out..." : "Logout"}
      </button>
    </GlassPanel>
  );
}

