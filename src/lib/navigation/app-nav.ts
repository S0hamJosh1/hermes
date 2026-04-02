export type AppNavItem = {
  label: string;
  href: string;
  iconKey: string;
  requiresBootcampComplete?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: "Dashboard", href: "/dashboard", iconKey: "dashboard" },
  { label: "Weekly Plan", href: "/plan", iconKey: "calendar", requiresBootcampComplete: true },
  { label: "Roadmap", href: "/roadmap", iconKey: "rocket", requiresBootcampComplete: true },
  { label: "Map", href: "/map", iconKey: "globe", requiresBootcampComplete: true },
  { label: "Hermes Chat", href: "/chat", iconKey: "chat", requiresBootcampComplete: true },
  { label: "Goal Settings", href: "/onboarding/goal", iconKey: "target" },
  { label: "Bootcamp", href: "/onboarding/bootcamp", iconKey: "lightning" },
];
