"use client";

import { ExitIcon, PersonIcon } from "@radix-ui/react-icons";
import { HamburgerMenuIcon } from "@radix-ui/react-icons";

type TopBarProps = {
  username?: string;
  displayName?: string;
  onLogout: () => Promise<void> | void;
  loggingOut?: boolean;
  onMenuToggle?: () => void;
};

function UserInitials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-white/80 select-none">
      {initials || <PersonIcon className="w-3.5 h-3.5" />}
    </div>
  );
}

export default function TopBar({
  username,
  displayName,
  onLogout,
  loggingOut = false,
  onMenuToggle,
}: TopBarProps) {
  const label = displayName || username;

  return (
    <header className="glass-panel-compact flex items-center justify-between px-4 py-2.5 lg:px-5 lg:py-3">
      {/* Left: brand + mobile hamburger */}
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            aria-label="Open menu"
            className="lg:hidden rounded-lg border border-white/15 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <HamburgerMenuIcon className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </div>
          <span className="text-[11px] font-semibold tracking-[0.25em] uppercase text-white/60">
            Hermes
          </span>
          <span className="hidden sm:inline text-white/20 text-xs font-light">|</span>
          <span className="hidden sm:inline text-xs text-white/40 tracking-wide">
            Training OS
          </span>
        </div>
      </div>

      {/* Right: user identity + logout */}
      <div className="flex items-center gap-3">
        {label && (
          <div className="flex items-center gap-2.5">
            <UserInitials name={label} />
            <div className="hidden sm:flex flex-col">
              {displayName ? (
                <>
                  <span className="text-xs text-white/80 font-medium leading-tight">
                    {displayName}
                  </span>
                  {username && (
                    <span className="text-[11px] text-white/40 leading-tight">
                      @{username}
                    </span>
                  )}
                </>
              ) : username ? (
                <span className="text-xs text-white/70 font-medium leading-tight">
                  @{username}
                </span>
              ) : null}
            </div>
          </div>
        )}

        <div className="h-5 w-px bg-white/10" />

        <button
          onClick={() => void onLogout()}
          disabled={loggingOut}
          title={loggingOut ? "Logging out..." : "Sign out"}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/50 transition hover:bg-white/10 hover:text-white/80 disabled:opacity-40"
        >
          <ExitIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{loggingOut ? "Signing out..." : "Sign out"}</span>
        </button>
      </div>
    </header>
  );
}
