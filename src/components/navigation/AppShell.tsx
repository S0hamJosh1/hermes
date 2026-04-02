"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HamburgerMenuIcon } from "@radix-ui/react-icons";
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
};

type FlowStatus = {
  bootcampCompleted: boolean;
  hasGoal: boolean;
  shouldGoToBootcamp: boolean;
  shouldGoToGoal: boolean;
};

type BootcampStatus = {
  alreadyCompleted?: boolean;
  daysElapsed: number;
  daysTotal: number;
};

const SHELL_PREFIXES = ["/dashboard", "/plan", "/roadmap", "/map", "/chat", "/health", "/onboarding"];
const SIDEBAR_STORAGE_KEY = "hermes.sidebar.collapsed";

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [flow, setFlow] = useState<FlowStatus | null>(null);
  const [bootcampProgressPct, setBootcampProgressPct] = useState<number | null>(null);
  const [gateReady, setGateReady] = useState(false);

  const inShell = useMemo(
    () => SHELL_PREFIXES.some((prefix) => pathname?.startsWith(prefix)),
    [pathname]
  );
  const currentLabel = useMemo(() => {
    const item = APP_NAV_ITEMS.find((n) => pathname === n.href || pathname?.startsWith(`${n.href}/`));
    if (item) return item.label;
    if (pathname?.startsWith("/onboarding")) return "Onboarding";
    if (pathname?.startsWith("/health")) return "Health";
    return "Workspace";
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "1") {
      setSidebarCollapsed(true);
    }
  }, []);

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
        const [meRes, flowRes, bootcampRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/onboarding/flow-status"),
          fetch("/api/onboarding/bootcamp/status"),
        ]);

        if (meRes.ok) {
          const me = (await meRes.json()) as MeResponse;
          if (!cancelled) setUsername(me.stravaUsername);
        }

        if (flowRes.ok) {
          const flowData = (await flowRes.json()) as FlowStatus;
          if (!cancelled) setFlow(flowData);
        }

        if (bootcampRes.ok) {
          const bootcamp = (await bootcampRes.json()) as BootcampStatus;
          if (!cancelled && !bootcamp.alreadyCompleted && bootcamp.daysTotal > 0) {
            const pct = (bootcamp.daysElapsed / bootcamp.daysTotal) * 100;
            setBootcampProgressPct(pct);
          } else if (!cancelled) {
            setBootcampProgressPct(100);
          }
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
      return;
    }
  }, [inShell, flow, pathname, router]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function handleSidebarToggle() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (!inShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen text-white">
      <GradientBackdrop />
      <MobileDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        bootcampCompleted={flow?.bootcampCompleted ?? false}
        bootcampProgressPct={bootcampProgressPct}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      <div className="relative z-10 px-3 py-3 lg:px-4 lg:py-4">
        <div className="lg:hidden mb-3 glass-panel px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/50">Hermes</p>
            <p className="text-sm text-white/85">{currentLabel}</p>
          </div>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-white/20 p-2 text-white/80 hover:bg-white/10"
          >
            <HamburgerMenuIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-auto flex items-stretch w-full max-w-[1600px] gap-4 min-h-[calc(100vh-2rem)]">
          <AppSidebar
            username={username}
            bootcampCompleted={flow?.bootcampCompleted ?? false}
            bootcampProgressPct={bootcampProgressPct}
            onLogout={handleLogout}
            loggingOut={loggingOut}
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleSidebarToggle}
          />

          <main className="flex-1 min-w-0">
            <div className="glass-panel p-4 lg:p-6 h-full animate-fade-in">
              {!gateReady ? (
                <div className="h-[60vh] flex items-center justify-center text-white/60 text-sm">
                  Loading workspace...
                </div>
              ) : (
                children
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
