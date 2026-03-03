export type AppNavItem = {
  label: string;
  href: string;
  icon: string;
  requiresBootcampComplete?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "◎" },
  { label: "Weekly Plan", href: "/plan", icon: "◈", requiresBootcampComplete: true },
  { label: "Roadmap", href: "/roadmap", icon: "◉", requiresBootcampComplete: true },
  { label: "Hermes Chat", href: "/chat", icon: "◌", requiresBootcampComplete: true },
  { label: "Goal Settings", href: "/onboarding/goal", icon: "◍" },
  { label: "Bootcamp", href: "/onboarding/bootcamp", icon: "◔" },
];

