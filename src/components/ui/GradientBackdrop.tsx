"use client";

export default function GradientBackdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div className="absolute inset-0 app-gradient-bg" />
      <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full app-orb app-orb-primary" />
      <div className="absolute top-1/3 -right-16 h-[28rem] w-[28rem] rounded-full app-orb app-orb-secondary" />
      <div className="absolute -bottom-20 left-1/3 h-80 w-80 rounded-full app-orb app-orb-tertiary" />
      <div className="absolute inset-0 app-grid-overlay" />
    </div>
  );
}

