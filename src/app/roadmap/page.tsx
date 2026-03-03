"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { kmToMiles } from "@/lib/units";
import {
    TargetIcon,
    LapTimerIcon,
    RocketIcon,
    TimerIcon,
    StarIcon,
    CheckCircledIcon,
} from "@radix-ui/react-icons";

/* ── Types ────────────────────────────────────────────────── */

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
    actualVolumeKm: number | null;
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

/* ── Helpers ──────────────────────────────────────────────── */

function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function fmtTime(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
        : `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtMilestoneTarget(metric: string | null, value: number | null) {
    if (!metric || value == null) return null;
    if (metric.includes("time_seconds")) return fmtTime(Math.round(value));
    return `${value} ${metric}`;
}

function daysUntil(d: string) {
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

function overallProgress(phases: RoadmapPhase[]) {
    if (!phases.length) return 0;
    const slice = 100 / phases.length;
    return Math.min(
        100,
        phases.reduce(
            (sum, p) =>
                sum +
                (p.isPast ? slice : p.isCurrent ? (p.progress / 100) * slice : 0),
            0
        )
    );
}

/* ── Phase icon picker ────────────────────────────────────── */

function PhaseIcon({ name, size = "w-3.5 h-3.5" }: { name: string; size?: string }) {
    switch (name) {
        case "Foundation":
            return <LapTimerIcon className={size} />;
        case "Build":
            return <RocketIcon className={size} />;
        case "Specificity":
            return <TargetIcon className={size} />;
        case "Taper":
            return <TimerIcon className={size} />;
        default:
            return <StarIcon className={size} />;
    }
}

/* ── Phase Card ───────────────────────────────────────────── */

function PhaseCard({ phase }: { phase: RoadmapPhase }) {
    const volume =
        phase.actualVolumeKm != null
            ? `${kmToMiles(phase.actualVolumeKm).toFixed(1)} mi/wk`
            : phase.targetVolumeKm != null
                ? `${kmToMiles(phase.targetVolumeKm).toFixed(1)} mi/wk target`
                : null;

    return (
        <div
            className={`border rounded-xl p-3 flex flex-col gap-2 transition ${phase.isCurrent
                    ? "border-white/30 bg-white/[0.06]"
                    : phase.isPast
                        ? "border-white/10 bg-white/[0.03] opacity-70"
                        : "border-white/10 bg-white/[0.02]"
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${phase.isCurrent
                                ? "bg-white/15 text-white"
                                : phase.isPast
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-white/10 text-white/50"
                            }`}
                    >
                        <PhaseIcon name={phase.phaseName} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold leading-tight">
                            Phase {phase.phaseNumber}: {phase.phaseName}
                        </p>
                        <p className="text-[10px] text-white/35 leading-tight">
                            {fmtDate(phase.startDate)} → {fmtDate(phase.endDate)}
                        </p>
                    </div>
                </div>
                {phase.isCurrent && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 text-white/70 font-medium">
                        Active
                    </span>
                )}
                {phase.isPast && (
                    <CheckCircledIcon className="w-3.5 h-3.5 text-green-400" />
                )}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 text-[10px] text-white/40 flex-wrap">
                {phase.focus && <span>{phase.focus}</span>}
                {volume && (
                    <>
                        <span className="text-white/20">·</span>
                        <span>{volume}</span>
                    </>
                )}
            </div>

            {/* Progress bar */}
            {(phase.isCurrent || phase.isPast) && (
                <div className="w-full bg-white/10 rounded-full h-1">
                    <div
                        className={`h-full rounded-full transition-all ${phase.isPast ? "bg-green-400/60" : "bg-white/50"
                            }`}
                        style={{ width: `${phase.progress}%` }}
                    />
                </div>
            )}

            {/* Milestones */}
            {phase.milestones.length > 0 && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                    {phase.milestones.map((m) => (
                        <div
                            key={m.id}
                            className="flex items-center justify-between text-[10px]"
                        >
                            <div className="flex items-center gap-1.5">
                                <span
                                    className={`w-1 h-1 rounded-full ${m.achieved ? "bg-green-400" : "bg-white/25"
                                        }`}
                                />
                                <span
                                    className={
                                        m.achieved
                                            ? "text-white/50 line-through"
                                            : "text-white/45"
                                    }
                                >
                                    {m.milestoneName}
                                </span>
                            </div>
                            <span className="text-white/25">
                                {fmtMilestoneTarget(m.targetMetric, m.targetValue) ??
                                    fmtDate(m.targetDate)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Road SVG constants ───────────────────────────────────── */

const ROAD = "M 40 60 L 840 60 A 80 80 0 0 1 840 220 L 40 220";

const MARKERS = [
    { cx: 220, cy: 60 },
    { cx: 660, cy: 60 },
    { cx: 660, cy: 220 },
    { cx: 220, cy: 220 },
];

/* ── Main Page ────────────────────────────────────────────── */

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
            if (!meRes.ok) {
                router.push("/");
                return;
            }
            if (roadmapRes.ok) {
                const data = await roadmapRes.json();
                setGoals(data.goals ?? []);
            }
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchRoadmap();
    }, [fetchRoadmap]);

    if (loading) {
        return (
            <main className="h-[70vh] text-white flex items-center justify-center">
                <div className="animate-pulse text-white/40">Loading roadmap...</div>
            </main>
        );
    }

    return (
        <main className="text-white flex flex-col items-center px-2 py-2">
            <div className="w-full max-w-6xl flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Roadmap</h1>
                        <p className="text-xs text-white/40 uppercase tracking-widest mt-0.5">
                            Training Phases &amp; Milestones
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
                    <div className="glass-card p-8 text-center">
                        <p className="text-white/40 text-sm mb-4">
                            No goals or roadmap set yet.
                        </p>
                        <p className="text-white/30 text-xs">
                            Set a goal during onboarding to generate your roadmap.
                        </p>
                    </div>
                )}

                {/* Goals */}
                {goals.map((goal) => {
                    const dLeft = daysUntil(goal.targetDate);
                    const phases = goal.roadmaps;
                    const pct = overallProgress(phases);

                    return (
                        <div key={goal.id} className="flex flex-col gap-5">
                            {/* ── Goal summary card ─────────────────── */}
                            <div className="glass-card p-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                                        <TargetIcon className="w-5 h-5 text-white/60" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">{goal.distance}</p>
                                        <p className="text-xs text-white/40">
                                            {fmtDate(goal.targetDate)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {goal.targetTimeSeconds && (
                                        <p className="text-sm font-medium">
                                            {fmtTime(goal.targetTimeSeconds)}
                                        </p>
                                    )}
                                    <p
                                        className={`text-xs ${dLeft > 0 ? "text-white/40" : "text-red-400"}`}
                                    >
                                        {dLeft > 0
                                            ? `${dLeft} days left`
                                            : dLeft === 0
                                                ? "Race day!"
                                                : `${Math.abs(dLeft)} days ago`}
                                    </p>
                                </div>
                            </div>

                            {/* ── Winding Road (desktop ≥ sm) ──────── */}
                            {phases.length >= 4 && (
                                <div className="hidden sm:flex flex-col gap-3">
                                    {/* Row 1 cards: Phase 1 (left), Phase 2 (right) */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <PhaseCard phase={phases[0]} />
                                        <PhaseCard phase={phases[1]} />
                                    </div>

                                    {/* SVG Road */}
                                    <svg
                                        viewBox="0 0 1000 280"
                                        className="w-full"
                                        preserveAspectRatio="xMidYMid meet"
                                    >
                                        {/* Checkerboard finish pattern */}
                                        <defs>
                                            <pattern
                                                id="checker"
                                                width="8"
                                                height="8"
                                                patternUnits="userSpaceOnUse"
                                            >
                                                <rect width="4" height="4" fill="white" fillOpacity="0.4" />
                                                <rect
                                                    x="4"
                                                    y="4"
                                                    width="4"
                                                    height="4"
                                                    fill="white"
                                                    fillOpacity="0.4"
                                                />
                                            </pattern>
                                        </defs>

                                        {/* Road edge */}
                                        <path
                                            d={ROAD}
                                            stroke="rgba(255,255,255,0.12)"
                                            strokeWidth="56"
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        {/* Road surface */}
                                        <path
                                            d={ROAD}
                                            stroke="rgba(255,255,255,0.05)"
                                            strokeWidth="50"
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        {/* Progress fill */}
                                        <path
                                            d={ROAD}
                                            stroke="rgba(255,255,255,0.08)"
                                            strokeWidth="50"
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            pathLength={100}
                                            strokeDasharray={`${pct} ${100 - pct}`}
                                        />
                                        {/* Dashed center line */}
                                        <path
                                            d={ROAD}
                                            stroke="rgba(255,255,255,0.18)"
                                            strokeWidth="2"
                                            fill="none"
                                            strokeDasharray="16 12"
                                        />

                                        {/* Start marker */}
                                        <circle
                                            cx="40"
                                            cy="60"
                                            r="10"
                                            fill="rgba(34,197,94,0.5)"
                                            stroke="rgba(34,197,94,0.7)"
                                            strokeWidth="2"
                                        />
                                        <text
                                            x="40"
                                            y="65"
                                            textAnchor="middle"
                                            fill="white"
                                            fontSize="12"
                                            fontWeight="bold"
                                        >
                                            S
                                        </text>

                                        {/* Phase markers */}
                                        {phases.slice(0, 4).map((p, i) => (
                                            <g key={p.id}>
                                                <circle
                                                    cx={MARKERS[i].cx}
                                                    cy={MARKERS[i].cy}
                                                    r="20"
                                                    fill={
                                                        p.isPast
                                                            ? "rgba(34,197,94,0.25)"
                                                            : p.isCurrent
                                                                ? "rgba(255,255,255,0.12)"
                                                                : "rgba(255,255,255,0.04)"
                                                    }
                                                    stroke={
                                                        p.isPast
                                                            ? "rgba(34,197,94,0.5)"
                                                            : p.isCurrent
                                                                ? "rgba(255,255,255,0.4)"
                                                                : "rgba(255,255,255,0.12)"
                                                    }
                                                    strokeWidth="2"
                                                />
                                                <text
                                                    x={MARKERS[i].cx}
                                                    y={MARKERS[i].cy + 6}
                                                    textAnchor="middle"
                                                    fill={
                                                        p.isPast
                                                            ? "rgba(34,197,94,0.9)"
                                                            : p.isCurrent
                                                                ? "white"
                                                                : "rgba(255,255,255,0.35)"
                                                    }
                                                    fontSize="16"
                                                    fontWeight="bold"
                                                    fontFamily="system-ui, sans-serif"
                                                >
                                                    {p.phaseNumber}
                                                </text>
                                            </g>
                                        ))}

                                        {/* Finish marker */}
                                        <rect
                                            x="25"
                                            y="207"
                                            width="30"
                                            height="26"
                                            rx="4"
                                            fill="url(#checker)"
                                        />
                                        <rect
                                            x="25"
                                            y="207"
                                            width="30"
                                            height="26"
                                            rx="4"
                                            fill="none"
                                            stroke="rgba(255,255,255,0.2)"
                                            strokeWidth="1.5"
                                        />
                                    </svg>

                                    {/* Row 2 cards: Phase 4 (left), Phase 3 (right) */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <PhaseCard phase={phases[3]} />
                                        <PhaseCard phase={phases[2]} />
                                    </div>
                                </div>
                            )}

                            {/* ── Mobile fallback (vertical) ──────── */}
                            {phases.length > 0 && (
                                <div className={`flex flex-col gap-3 ${phases.length >= 4 ? "sm:hidden" : ""}`}>
                                    {phases.map((phase) => (
                                        <PhaseCard key={phase.id} phase={phase} />
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
