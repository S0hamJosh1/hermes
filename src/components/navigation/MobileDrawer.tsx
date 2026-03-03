"use client";

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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close menu"
      />
      <div className="absolute left-0 top-0 h-full w-72 border-r border-white/20 bg-black/50 backdrop-blur-2xl p-4 flex flex-col">
        <p className="text-xs tracking-[0.2em] uppercase text-white/50">Hermes</p>
        <p className="text-xl font-semibold text-white mt-1 mb-4">Menu</p>

        {!bootcampCompleted && (
          <div className="mb-4 rounded-xl border border-white/15 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-widest text-white/50">Bootcamp</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 transition-all"
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
                    ? "bg-white/15 text-white border border-white/20"
                    : "text-white/70 hover:text-white hover:bg-white/10 border border-transparent"
                }`}
              >
                <span className="text-white/70">{item.icon}</span>
                <span>{item.label}</span>
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
      </div>
    </div>
  );
}

