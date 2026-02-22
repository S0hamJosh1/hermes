"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { kmToMiles } from "@/lib/units";

type Milestone = {
    id: string;
    milestoneName: string;
    targetDate: string;
    targetMetric: string | null;
    targetValue: number | null;
    achieved: boolean;
    achievedDate: string | null;
};

type RoadmapPhase = {
    id: string;
    phaseNumber: number;
    phaseName: string;
    startDate: string;
    endDate: string;
    targetVolumeKm: number | null;
    focus: string | null;
    progress: number;
    isCurrent: boolean;
    isPast: boolean;
    milestones: Milestone[];
};

type Goal = {
    id: string;
    distance: string;
    targetDate: string;
    targetTimeSeconds: number | null;
    priority: number;
    roadmaps: RoadmapPhase[];
};

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
        return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatMilestoneTarget(metric: string | null, value: number | null): string | null {
    if (!metric || value == null) return null;
    if (metric.includes("time_seconds")) {
        return formatTime(Math.round(value));
    }
    return `${value} ${metric}`;
}

function daysUntil(dateStr: string): number {
    const target = new Date(dateStr).getTime();
    const now = Date.now();
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export default function RoadmapPage() {
    const router = useRouter();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRoadmap = useCallback(async () => {
        try {
            const [meRes, roadmapRes] = await Promise.all([
                fetch("/api/auth/me"),
                fetch("/api/roadmap"),
            ]);
            if (!meRes.ok) { router.push("/"); return; }
            if (roadmapRes.ok) {
                const data = await roadmapRes.json();
                setGoals(data.goals ?? []);
            }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [router]);

    useEffect(() => { fetchRoadmap(); }, [fetchRoadmap]);

    if (loading) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-pulse text-white/40">Loading roadmap...</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-10">
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                }}
            />

            <div className="relative z-10 w-full max-w-lg flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Roadmap</h1>
                        <p className="text-xs text-white/40 uppercase tracking-widest mt-0.5">
                            Training Phases & Milestones
                        </p>
                    </div>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="text-xs text-white/40 hover:text-white/70 transition"
                    >
                        ← Dashboard
                    </button>
                </div>

                {/* Empty state */}
                {goals.length === 0 && (
                    <div className="border border-white/10 rounded-xl p-8 text-center">
                        <p className="text-white/40 text-sm mb-4">No goals or roadmap set yet.</p>
                        <p className="text-white/30 text-xs">
                            Set a goal during onboarding to generate your roadmap.
                        </p>
                    </div>
                )}

                {/* Goals */}
                {goals.map((goal) => {
                    const daysLeft = daysUntil(goal.targetDate);
                    const checkpoints = goal.roadmaps
                        .flatMap((r) => r.milestones)
                        .sort(
                            (a, b) =>
                                new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
                        );

                    return (
                        <div key={goal.id} className="flex flex-col gap-5">
                            {/* Goal card */}
                            <div className="border border-white/10 rounded-xl p-5 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-lg">
                                            🎯
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{goal.distance}</p>
                                            <p className="text-xs text-white/40">
                                                {formatDate(goal.targetDate)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {goal.targetTimeSeconds && (
                                            <p className="text-sm font-medium">
                                                {formatTime(goal.targetTimeSeconds)}
                                            </p>
                                        )}
                                        <p className={`text-xs ${daysLeft > 0 ? "text-white/40" : "text-red-400"}`}>
                                            {daysLeft > 0
                                                ? `${daysLeft} days left`
                                                : daysLeft === 0
                                                    ? "Race day!"
                                                    : `${Math.abs(daysLeft)} days ago`}
                                        </p>
                                    </div>
                                </div>

                                {checkpoints.length > 0 && (
                                    <div className="mt-1 border-t border-white/10 pt-4">
                                        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">
                                            Path to Goal
                                        </p>
                                        <div className="relative">
                                            <svg
                                                viewBox="0 0 100 28"
                                                className="w-full h-16"
                                                preserveAspectRatio="none"
                                            >
                                                <path
                                                    d="M 2 22 C 22 4, 38 24, 58 10 S 84 6, 98 14"
                                                    stroke="rgba(255,255,255,0.35)"
                                                    strokeWidth="1.5"
                                                    fill="none"
                                                />
                                                {checkpoints.map((_, i) => {
                                                    const x = checkpoints.length === 1 ? 98 : 2 + (96 * i) / (checkpoints.length - 1);
                                                    const y = 16 + Math.sin(i * 1.3) * 6;
                                                    return (
                                                        <circle
                                                            key={i}
                                                            cx={x}
                                                            cy={y}
                                                            r="1.8"
                                                            fill="white"
                                                            opacity="0.9"
                                                        />
                                                    );
                                                })}
                                            </svg>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {checkpoints.map((cp) => (
                                                <div
                                                    key={cp.id}
                                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                                                >
                                                    <p className="text-white/70 font-medium">{cp.milestoneName}</p>
                                                    <p className="text-white/40">
                                                        {formatDate(cp.targetDate)}
                                                        {formatMilestoneTarget(cp.targetMetric, cp.targetValue) && (
                                                            <span className="ml-2 text-white/60">
                                                                • {formatMilestoneTarget(cp.targetMetric, cp.targetValue)}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Timeline */}
                            {goal.roadmaps.length > 0 && (
                                <div className="flex flex-col gap-0 relative ml-4">
                                    {/* Vertical line */}
                                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />

                                    {goal.roadmaps.map((phase, i) => (
                                        <div key={phase.id} className="relative flex gap-4 pb-6 last:pb-0">
                                            {/* Dot */}
                                            <div className="relative z-10 flex-shrink-0 mt-1">
                                                <div className={`w-[15px] h-[15px] rounded-full border-2 ${phase.isCurrent
                                                        ? "bg-white border-white"
                                                        : phase.isPast
                                                            ? "bg-green-400 border-green-400"
                                                            : "bg-transparent border-white/30"
                                                    }`} />
                                            </div>

                                            {/* Phase content */}
                                            <div className={`flex-1 border rounded-xl p-4 flex flex-col gap-3 ${phase.isCurrent
                                                    ? "border-white/30 bg-white/5"
                                                    : "border-white/10"
                                                }`}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            Phase {phase.phaseNumber}: {phase.phaseName}
                                                        </p>
                                                        <p className="text-xs text-white/40 mt-0.5">
                                                            {formatDate(phase.startDate)} → {formatDate(phase.endDate)}
                                                        </p>
                                                    </div>
                                                    {phase.isCurrent && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white/70">
                                                            Active
                                                        </span>
                                                    )}
                                                    {phase.isPast && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                                            Complete
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Meta */}
                                                <div className="flex items-center gap-3 text-xs text-white/40">
                                                    {phase.focus && <span>{phase.focus}</span>}
                                                    {phase.targetVolumeKm && (
                                                        <span>{kmToMiles(phase.targetVolumeKm).toFixed(1)} mi/wk target</span>
                                                    )}
                                                </div>

                                                {/* Progress bar */}
                                                {(phase.isCurrent || phase.isPast) && (
                                                    <div className="w-full bg-white/10 rounded-full h-1.5">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${phase.isPast ? "bg-green-400" : "bg-white/60"
                                                                }`}
                                                            style={{ width: `${phase.progress}%` }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Milestones */}
                                                {phase.milestones.length > 0 && (
                                                    <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                                                        {phase.milestones.map((m) => (
                                                            <div
                                                                key={m.id}
                                                                className="flex items-center justify-between text-xs"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${m.achieved ? "bg-green-400" : "bg-white/20"
                                                                        }`} />
                                                                    <span className={m.achieved ? "text-white/60 line-through" : "text-white/50"}>
                                                                        {m.milestoneName}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-white/30">
                                                                    {m.targetMetric && m.targetValue && (
                                                                        <span>{m.targetValue} {m.targetMetric}</span>
                                                                    )}
                                                                    <span>{formatDate(m.targetDate)}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </main>
    );
}
