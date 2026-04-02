"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ExitIcon,
  HamburgerMenuIcon,
  PersonIcon,
} from "@radix-ui/react-icons";
import GradientBackdrop from "@/components/ui/GradientBackdrop";
import AppSidebar from "@/components/navigation/AppSidebar";
import MobileDrawer from "@/components/navigation/MobileDrawer";
import { APP_NAV_ITEMS } from "@/lib/navigation/app-nav";

type AppShellProps = {
  children: React.ReactNode;
};

type MeResponse = {
  authenticated: boolean;
  stravaUsername?: string;
  displayName?: string;
};

type FlowStatus = {
  bootcampCompleted: boolean;
  hasGoal: boolean;
  shouldGoToBootcamp: boolean;
  shouldGoToGoal: boolean;
};

const SHELL_PREFIXES = ["/dashboard", "/plan", "/roadmap", "/map", "/chat", "/health", "/onboarding"];

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [runnerIdentity, setRunnerIdentity] = useState<Pick<MeResponse, "stravaUsername" | "displayName">>({});
  const [flow, setFlow] = useState<FlowStatus | null>(null);
  const [gateReady, setGateReady] = useState(false);

  const inShell = useMemo(
    () => SHELL_PREFIXES.some((prefix) => pathname?.startsWith(prefix)),
    [pathname]
  );

  const currentLabel = useMemo(() => {
    const item = APP_NAV_ITEMS.find((navItem) => pathname === navItem.href || pathname?.startsWith(`${navItem.href}/`));
    if (item) return item.label;
    if (pathname?.startsWith("/onboarding")) return "Onboarding";
    if (pathname?.startsWith("/health")) return "Health";
    return "Workspace";
  }, [pathname]);

  const runnerName = useMemo(() => {
    if (runnerIdentity.displayName?.trim()) return runnerIdentity.displayName.trim();
    if (runnerIdentity.stravaUsername?.trim()) return `@${runnerIdentity.stravaUsername.trim()}`;
    return "Runner";
  }, [runnerIdentity.displayName, runnerIdentity.stravaUsername]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!inShell) return;
    let cancelled = false;

    async function loadShellData() {
      try {
        const [meRes, flowRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/onboarding/flow-status"),
        ]);

        if (meRes.ok) {
          const me = (await meRes.json()) as MeResponse;
          if (!cancelled) {
            setRunnerIdentity({
              stravaUsername: me.stravaUsername,
              displayName: me.displayName,
            });
          }
        }

        if (flowRes.ok) {
          const flowData = (await flowRes.json()) as FlowStatus;
          if (!cancelled) setFlow(flowData);
        }
      } finally {
        if (!cancelled) setGateReady(true);
      }
    }

    void loadShellData();
    return () => {
      cancelled = true;
    };
  }, [inShell, pathname]);

  useEffect(() => {
    if (!inShell || !flow) return;
    const onBootcamp = pathname === "/onboarding/bootcamp";
    const onGoal = pathname === "/onboarding/goal";

    if (flow.shouldGoToBootcamp && !onBootcamp) {
      router.replace("/onboarding/bootcamp");
      return;
    }

    if (!flow.shouldGoToBootcamp && flow.shouldGoToGoal && !onGoal) {
      router.replace("/onboarding/goal");
    }
  }, [flow, inShell, pathname, router]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (!inShell) {
    return <>{children}</>;
  }

  return (
    <div className="relative isolate h-screen overflow-hidden text-white">
      <GradientBackdrop />

      <MobileDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        bootcampCompleted={flow?.bootcampCompleted ?? false}
      />

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <header className="fixed inset-x-3 top-3 z-30 lg:inset-x-4">
          <div className="glass-panel flex h-16 items-center justify-between px-3 sm:px-4 lg:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="rounded-xl border border-white/15 bg-white/5 p-2 text-white/75 transition hover:bg-white/10 hover:text-white lg:hidden"
              >
                <HamburgerMenuIcon className="h-4 w-4" />
              </button>

              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">Hermes OS</p>
                <p className="truncate text-sm font-semibold text-white sm:text-base">{currentLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-2.5 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/78">
                  <PersonIcon className="h-4 w-4" />
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="truncate text-sm text-white/85">{runnerName}</p>
                  <p className="truncate text-[10px] uppercase tracking-[0.18em] text-white/35">
                    {runnerIdentity.stravaUsername ? "Connected to Strava" : "Runner profile"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                aria-label="Logout"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <ExitIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 px-3 pb-3 pt-[5.5rem] lg:px-4">
          <aside className="fixed bottom-4 left-4 top-[5.5rem] hidden w-72 lg:block">
            <AppSidebar bootcampCompleted={flow?.bootcampCompleted ?? false} />
          </aside>

          <main className="h-full min-h-0 min-w-0 lg:pl-[19rem]">
            <div className="glass-panel h-full">
              <div className="h-full min-h-0 overflow-y-auto p-4 lg:p-6 animate-fade-in">
                {!gateReady ? (
                  <div className="flex h-[60vh] items-center justify-center text-sm text-white/60">
                    Loading workspace...
                  </div>
                ) : (
                  children
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
