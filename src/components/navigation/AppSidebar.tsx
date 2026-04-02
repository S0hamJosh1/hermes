"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GlassPanel from "@/components/ui/GlassPanel";
import { APP_NAV_ITEMS } from "@/lib/navigation/app-nav";
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

type AppSidebarProps = {
  bootcampCompleted: boolean;
};

const ICON_MAP: Record<string, ReactNode> = {
  dashboard: <DashboardIcon className="h-4 w-4" />,
  calendar: <CalendarIcon className="h-4 w-4" />,
  rocket: <RocketIcon className="h-4 w-4" />,
  globe: <GlobeIcon className="h-4 w-4" />,
  chat: <PaperPlaneIcon className="h-4 w-4" />,
  target: <TargetIcon className="h-4 w-4" />,
  lightning: <LightningBoltIcon className="h-4 w-4" />,
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppSidebar({ bootcampCompleted }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <GlassPanel className="h-full p-3">
      <nav className="flex h-full flex-col gap-1">
        {APP_NAV_ITEMS.filter((item) =>
          item.href !== "/onboarding/bootcamp" || !bootcampCompleted
        ).map((item) => {
          const blocked = Boolean(item.requiresBootcampComplete && !bootcampCompleted);
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={blocked ? "/onboarding/bootcamp" : item.href}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                active
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-transparent text-white/68 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <span className={active ? "text-white/80" : "text-white/45"}>
                {ICON_MAP[item.iconKey]}
              </span>
              <span>{item.label}</span>
              {!bootcampCompleted && item.href === "/onboarding/bootcamp" ? (
                <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/55">
                  Active
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </GlassPanel>
  );
}
