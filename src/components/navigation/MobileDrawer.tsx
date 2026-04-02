"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { APP_NAV_ITEMS } from "@/lib/navigation/app-nav";
import {
  DashboardIcon,
  CalendarIcon,
  RocketIcon,
  GlobeIcon,
  PaperPlaneIcon,
  TargetIcon,
  LightningBoltIcon,
  Cross1Icon,
} from "@radix-ui/react-icons";
import type { ReactNode } from "react";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
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

export default function MobileDrawer({
  open,
  onClose,
  bootcampCompleted,
}: MobileDrawerProps) {
  const pathname = usePathname();

  return (
    <div className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`}>
      <button
        className={`absolute inset-0 bg-[#020a18]/68 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-label="Close menu"
      />

      <div
        className={`absolute left-0 top-0 h-full w-72 border-r border-white/15 bg-[#050912]/88 p-4 backdrop-blur-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0">
              <Image
                src="/hermes-mark.png"
                alt="Hermes"
                fill
                sizes="44px"
                priority
                className="object-contain object-center opacity-95"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Hermes</p>
              <p className="mt-1 text-base font-semibold text-white">Navigation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-xl border border-white/15 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <Cross1Icon className="h-4 w-4" />
          </button>
        </div>

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
      </div>
    </div>
  );
}
