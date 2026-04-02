"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  DashboardIcon,
  ExitIcon,
  HamburgerMenuIcon,
  PersonIcon,
  GearIcon,
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
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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

  const runnerMeta = runnerIdentity.stravaUsername?.trim()
    ? `@${runnerIdentity.stravaUsername.trim()}`
    : "Strava profile unavailable";

  useEffect(() => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
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
    function handlePointerDown(event: MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    if (!profileMenuOpen) return;
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [profileMenuOpen]);

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
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (!inShell) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen overflow-hidden text-white">
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

              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.03] p-2">
                <Image
                  src="/hermes-mark.png"
                  alt="Hermes"
                  width={24}
                  height={24}
                  priority
                  className="h-full w-full object-contain opacity-95"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">Hermes</p>
                <p className="truncate text-sm font-semibold text-white sm:text-base">{currentLabel}</p>
              </div>
            </div>

            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen((current) => !current)}
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-2.5 py-2 text-left transition hover:bg-white/10"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] text-white/78">
                  <PersonIcon className="h-4 w-4" />
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="truncate text-sm text-white/85">{runnerName}</p>
                  <p className="truncate text-[10px] uppercase tracking-[0.18em] text-white/35">
                    {runnerIdentity.stravaUsername ? "Connected to Strava" : "Runner profile"}
                  </p>
                </div>
                <ChevronDownIcon className={`h-4 w-4 text-white/55 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
              </button>

              <div
                className={`absolute right-0 top-[calc(100%+0.75rem)] w-64 rounded-[1.35rem] border border-white/12 bg-[#090d14]/88 p-2 shadow-[0_24px_48px_rgba(0,0,0,0.38)] backdrop-blur-2xl transition-all ${
                  profileMenuOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
                }`}
              >
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-white/78">
                      <PersonIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Runner profile</p>
                      <p className="mt-1 truncate text-sm font-medium text-white">{runnerName}</p>
                      <p className="mt-0.5 truncate text-xs text-white/45">{runnerMeta}</p>
                      <p className="mt-2 text-xs text-white/45">
                        {runnerIdentity.stravaUsername
                          ? "Connected with Strava and ready to train."
                          : "Signed in and ready to train."}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    router.push("/dashboard");
                  }}
                  className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <DashboardIcon className="h-4 w-4 text-white/45" />
                  Dashboard
                </button>

                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    router.push("/onboarding/goal");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <GearIcon className="h-4 w-4 text-white/45" />
                  Settings
                </button>

                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    void handleLogout();
                  }}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                >
                  <ExitIcon className="h-4 w-4 text-white/45" />
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
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
