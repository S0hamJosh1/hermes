"use client";

import type { ReactNode } from "react";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
};

export default function GlassPanel({ children, className = "" }: GlassPanelProps) {
  return (
    <div className={`glass-panel ${className}`}>
      {children}
    </div>
  );
}

