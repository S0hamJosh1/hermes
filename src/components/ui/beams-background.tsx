"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface AnimatedGradientBackgroundProps {
  className?: string;
  children?: ReactNode;
  intensity?: "subtle" | "medium" | "strong";
}

interface Beam {
  x: number;
  y: number;
  width: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
  hue: number;
  pulse: number;
  pulseSpeed: number;
}

const MINIMUM_BEAMS = 18;

const opacityMap = {
  subtle: 0.7,
  medium: 0.85,
  strong: 1,
};

const blurMap = {
  subtle: 28,
  medium: 34,
  strong: 40,
};

function createBeam(width: number, height: number, index: number, totalBeams: number): Beam {
  const columns = Math.max(3, Math.min(5, Math.round(width / 420)));
  const spacing = width / columns;
  const column = index % columns;

  return {
    x: column * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.72,
    y: height + Math.random() * height * 1.3,
    width: 68 + Math.random() * 80,
    length: height * (1.9 + Math.random() * 0.8),
    angle: -38 + Math.random() * 12,
    speed: 0.45 + Math.random() * 0.55,
    opacity: 0.14 + Math.random() * 0.14,
    hue: 192 + (index * 72) / Math.max(totalBeams, 1) + Math.random() * 10,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.018 + Math.random() * 0.028,
  };
}

export function BeamsBackground({
  className,
  children,
  intensity = "strong",
}: AnimatedGradientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beamsRef = useRef<Beam[]>([]);
  const animationFrameRef = useRef<number>(0);
  const viewportRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateCanvasSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      viewportRef.current = { width, height };
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const totalBeams = Math.max(MINIMUM_BEAMS, Math.round(width / 92));
      beamsRef.current = Array.from({ length: totalBeams }, (_, index) =>
        createBeam(width, height, index, totalBeams)
      );
    };

    const resetBeam = (beam: Beam, index: number, totalBeams: number) => {
      const { width, height } = viewportRef.current;
      const columns = Math.max(3, Math.min(5, Math.round(width / 420)));
      const spacing = width / columns;
      const column = index % columns;

      beam.x = column * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.68;
      beam.y = height + 120 + Math.random() * (height * 0.45);
      beam.width = 70 + Math.random() * 86;
      beam.length = height * (1.8 + Math.random() * 0.75);
      beam.angle = -40 + Math.random() * 14;
      beam.speed = 0.42 + Math.random() * 0.58;
      beam.hue = 192 + (index * 74) / Math.max(totalBeams, 1) + Math.random() * 8;
      beam.opacity = 0.14 + Math.random() * 0.14;
      beam.pulse = Math.random() * Math.PI * 2;
      beam.pulseSpeed = 0.018 + Math.random() * 0.028;
    };

    const drawBeam = (beam: Beam) => {
      ctx.save();
      ctx.translate(beam.x, beam.y);
      ctx.rotate((beam.angle * Math.PI) / 180);

      const pulsingOpacity =
        beam.opacity *
        (0.8 + Math.sin(beam.pulse) * 0.2) *
        opacityMap[intensity];

      const gradient = ctx.createLinearGradient(0, 0, 0, beam.length);
      gradient.addColorStop(0, `hsla(${beam.hue}, 90%, 66%, 0)`);
      gradient.addColorStop(0.1, `hsla(${beam.hue}, 90%, 66%, ${pulsingOpacity * 0.45})`);
      gradient.addColorStop(0.42, `hsla(${beam.hue}, 90%, 66%, ${pulsingOpacity})`);
      gradient.addColorStop(0.62, `hsla(${beam.hue}, 90%, 66%, ${pulsingOpacity})`);
      gradient.addColorStop(0.9, `hsla(${beam.hue}, 90%, 66%, ${pulsingOpacity * 0.42})`);
      gradient.addColorStop(1, `hsla(${beam.hue}, 90%, 66%, 0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
      ctx.restore();
    };

    const animate = () => {
      const { width, height } = viewportRef.current;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.filter = `blur(${blurMap[intensity]}px)`;

      const totalBeams = beamsRef.current.length;
      beamsRef.current.forEach((beam, index) => {
        beam.y -= beam.speed;
        beam.pulse += beam.pulseSpeed;

        if (beam.y + beam.length < -140) {
          resetBeam(beam, index, totalBeams);
        }

        drawBeam(beam);
      });

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [intensity]);

  return (
    <div
      className={cn(
        "relative min-h-screen w-full overflow-hidden bg-[#020612]",
        className
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="absolute inset-0 bg-[radial-gradient(1200px_720px_at_12%_10%,rgba(111,219,255,0.14),transparent_55%),radial-gradient(900px_600px_at_88%_16%,rgba(94,145,255,0.14),transparent_52%),radial-gradient(1100px_760px_at_50%_110%,rgba(255,255,255,0.04),transparent_62%)]" />

      <motion.div
        className="absolute inset-0 bg-[#020612]/32"
        animate={{ opacity: [0.62, 0.74, 0.62] }}
        transition={{
          duration: 12,
          ease: "easeInOut",
          repeat: Number.POSITIVE_INFINITY,
        }}
        style={{ backdropFilter: "blur(52px)" }}
      />

      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(1,6,16,0.2),rgba(1,6,16,0.1)_24%,rgba(1,6,16,0.16)_72%,rgba(1,6,16,0.36))]" />

      {children ? <div className="relative z-10 min-h-screen w-full">{children}</div> : null}
    </div>
  );
}
