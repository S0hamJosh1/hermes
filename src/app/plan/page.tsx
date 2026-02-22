"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatMiles, formatPacePerMile, kmToMiles } from "@/lib/units";

type Workout = {
    id: string;
    workoutDate: string;
    workoutType: string;
    plannedDistanceKm: number | null;
    plannedDurationMinutes: number | null;
    plannedPaceSecondsPerKm: number | null;
    intensityZone: string | null;
    actualDistanceKm: number | null;
    actualDurationSeconds: number | null;
    actualPaceSecondsPerKm: number | null;
    completed: boolean;
    completedAt: string | null;
    dayOfWeek: number;
    orderInWeek: number;
    userModified: boolean;
};

type Plan = {
    id: string;
    weekStartDate: string;
    weekEndDate: string;
    weekNumber: number;
    stateAtGeneration: string;
    totalVolumeKm: number;
    totalDurationMinutes: number;
    validationStatus: string;
    published: boolean;
    publishedAt: string | null;
    userEdited: boolean;
    workouts: Workout[];
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    easy_run: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
    recovery: { bg: "bg-green-500/10", text: "text-green-300", border: "border-green-500/20" },
    long_run: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    tempo: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
    interval: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
    fartlek: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
    pace_run: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
    time_trial: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
    rest: { bg: "bg-white/5", text: "text-white/30", border: "border-white/10" },
    cross_training: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
};

function getTypeStyle(type: string) {
    return TYPE_STYLES[type] ?? { bg: "bg-white/5", text: "text-white/60", border: "border-white/10" };
}

function prettifyType(type: string): string {
    return type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

export default function PlanPage() {
    const router = useRouter();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);

    const fetchPlans = useCallback(async () => {
        try {
            const [meRes, plansRes] = await Promise.all([
                fetch("/api/auth/me"),
                fetch("/api/plans?limit=12"),
            ]);
            if (!meRes.ok) { router.push("/"); return; }
            if (plansRes.ok) {
                const data = await plansRes.json();
                setPlans(data.plans ?? []);
            }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [router]);

    useEffect(() => { fetchPlans(); }, [fetchPlans]);

    async function handleGenerate() {
        setGenerating(true);
        setGenError(null);
        try {
            const res = await fetch("/api/plans/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setGenError(data.error ?? "Failed to generate plan");
            } else {
                setCurrentIndex(0);
                await fetchPlans();
            }
        } catch {
            setGenError("Network error");
        } finally {
            setGenerating(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-pulse text-white/40">Loading plans...</div>
            </main>
        );
    }

    const plan = plans[currentIndex];
    const isCurrentWeek = currentIndex === 0;

    // Build a 7-slot array (Mon=0..Sun=6) for the plan
    const daySlots: (Workout | null)[] = Array(7).fill(null);
    if (plan) {
        for (const w of plan.workouts) {
            // dayOfWeek: 0=Mon..6=Sun (our convention)
            const idx = w.dayOfWeek;
            if (idx >= 0 && idx < 7) daySlots[idx] = w;
        }
    }

    // Figure out which day is today (0=Mon..6=Sun)
    const now = new Date();
    const todayIdx = (now.getDay() + 6) % 7;

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

            <div className="relative z-10 w-full max-w-2xl flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Weekly Plan</h1>
                        <p className="text-xs text-white/40 uppercase tracking-widest mt-0.5">
                            Training Schedule
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition disabled:opacity-50"
                        >
                            {generating ? "Generating..." : "+ Generate"}
                        </button>
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="text-xs text-white/40 hover:text-white/70 transition"
                        >
                            ← Dashboard
                        </button>
                    </div>
                </div>
                {genError && (
                    <p className="text-red-400 text-xs text-center">{genError}</p>
                )}

                {/* No plans state */}
                {plans.length === 0 && (
                    <div className="border border-white/10 rounded-xl p-8 text-center flex flex-col items-center gap-4">
                        <p className="text-white/40 text-sm">No training plans generated yet.</p>
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="px-5 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition disabled:opacity-50"
                        >
                            {generating ? "Generating..." : "Generate This Week's Plan"}
                        </button>
                        {genError && (
                            <p className="text-red-400 text-xs">{genError}</p>
                        )}
                    </div>
                )}

                {/* Plan navigation + metadata */}
                {plan && (
                    <>
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setCurrentIndex(Math.min(plans.length - 1, currentIndex + 1))}
                                disabled={currentIndex >= plans.length - 1}
                                className="text-xs text-white/40 hover:text-white/70 transition disabled:opacity-20 disabled:cursor-not-allowed"
                            >
                                ← Older
                            </button>
                            <div className="text-center">
                                <p className="text-sm font-medium">
                                    Week {plan.weekNumber}
                                    {isCurrentWeek && (
                                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                            Current
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-white/40">
                                    {formatDate(plan.weekStartDate)} — {formatDate(plan.weekEndDate)}
                                </p>
                            </div>
                            <button
                                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                                disabled={currentIndex <= 0}
                                className="text-xs text-white/40 hover:text-white/70 transition disabled:opacity-20 disabled:cursor-not-allowed"
                            >
                                Newer →
                            </button>
                        </div>

                        {/* Metadata bar */}
                        <div className="flex items-center gap-4 flex-wrap text-xs text-white/40">
                            <span>{formatMiles(plan.totalVolumeKm)} total</span>
                            <span>·</span>
                            <span>{Math.round(plan.totalDurationMinutes / 60 * 10) / 10} hrs</span>
                            <span>·</span>
                            <span>{plan.stateAtGeneration}</span>
                            <span>·</span>
                            <span className={
                                plan.validationStatus === "passed"
                                    ? "text-green-400"
                                    : plan.validationStatus === "repaired"
                                        ? "text-yellow-400"
                                        : "text-white/40"
                            }>
                                {plan.validationStatus}
                            </span>
                        </div>

                        {/* Day cards grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {daySlots.map((workout, idx) => {
                                const isToday = isCurrentWeek && idx === todayIdx;
                                const isOptionalRunDay =
                                    Boolean(
                                        workout &&
                                        workout.workoutType === "easy_run" &&
                                        (workout.plannedDistanceKm == null || workout.plannedDistanceKm <= 0)
                                    );
                                const style = workout
                                    ? getTypeStyle(workout.workoutType)
                                    : getTypeStyle("rest");

                                return (
                                    <div
                                        key={idx}
                                        className={`rounded-xl border p-4 flex flex-col gap-2 transition ${style.bg} ${style.border} ${isToday ? "ring-1 ring-white/30" : ""
                                            }`}
                                    >
                                        {/* Day header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white/50">
                                                    {DAY_LABELS[idx]}
                                                </span>
                                                {isToday && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                                                        TODAY
                                                    </span>
                                                )}
                                            </div>
                                            {workout?.completed && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                                    ✓ Done
                                                </span>
                                            )}
                                        </div>

                                        {/* Workout details */}
                                        {workout && workout.workoutType !== "rest" ? (
                                            <>
                                                <p className={`text-sm font-medium ${style.text}`}>
                                                    {isOptionalRunDay
                                                        ? "Optional Easy Run"
                                                        : prettifyType(workout.workoutType)}
                                                </p>
                                                <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
                                                    {isOptionalRunDay ? (
                                                        <span>Run by feel (20–30 min optional)</span>
                                                    ) : workout.plannedDistanceKm ? (
                                                        <span>{formatMiles(workout.plannedDistanceKm)}</span>
                                                    ) : null}
                                                    {!isOptionalRunDay && workout.plannedPaceSecondsPerKm && (
                                                        <span>{formatPacePerMile(workout.plannedPaceSecondsPerKm)}</span>
                                                    )}
                                                    {!isOptionalRunDay && workout.plannedDurationMinutes && (
                                                        <span>{workout.plannedDurationMinutes} min</span>
                                                    )}
                                                    {!isOptionalRunDay && workout.intensityZone && (
                                                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                                                            {workout.intensityZone}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Actual vs Planned comparison */}
                                                {workout.completed && workout.actualDistanceKm && (
                                                    <div className="border-t border-white/10 pt-2 mt-1">
                                                        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Actual</p>
                                                        <div className="flex items-center gap-3 text-xs text-white/50">
                                                            <span>{kmToMiles(workout.actualDistanceKm).toFixed(1)} mi</span>
                                                            {workout.actualPaceSecondsPerKm && (
                                                                <span>{formatPacePerMile(workout.actualPaceSecondsPerKm)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-sm text-white/30">Rest Day</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
