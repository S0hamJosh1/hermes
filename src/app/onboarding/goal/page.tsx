"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Distance = "5K" | "10K" | "Half Marathon" | "Marathon";

type GoalResult = {
    ok?: boolean;
    goalId?: string;
    weeksUntilRace?: number;
    feasible?: boolean;
    feasibilityNote?: string;
    error?: string;
};

type ExistingGoalResponse = {
    ok?: boolean;
    goal?: {
        id: string;
        distance: Distance;
        targetDate: string;
        targetTimeSeconds: number | null;
    } | null;
    archivedGoals?: {
        id: string;
        distance: Distance;
        targetDate: string;
        targetTimeSeconds: number | null;
        createdAt: string;
    }[];
    error?: string;
};

const DISTANCES: { value: Distance; label: string; emoji: string; minWeeks: number }[] = [
    { value: "5K", label: "5K", emoji: "🏃", minWeeks: 4 },
    { value: "10K", label: "10K", emoji: "⚡", minWeeks: 6 },
    { value: "Half Marathon", label: "Half Marathon", emoji: "🔥", minWeeks: 10 },
    { value: "Marathon", label: "Marathon", emoji: "💀", minWeeks: 16 },
];

// Get minimum date for a given distance
function minDate(minWeeks: number): string {
    const d = new Date();
    d.setDate(d.getDate() + minWeeks * 7);
    return d.toISOString().split("T")[0];
}

// Format seconds as H:MM:SS or M:SS
function formatTime(seconds: number): string {
    if (seconds >= 3600) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

export default function GoalPage() {
    const router = useRouter();
    const [distance, setDistance] = useState<Distance | null>(null);
    const [targetDate, setTargetDate] = useState("");
    const [hasTargetTime, setHasTargetTime] = useState(false);
    const [targetHours, setTargetHours] = useState(0);
    const [targetMinutes, setTargetMinutes] = useState(0);
    const [targetSeconds, setTargetSeconds] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [loadingExistingGoal, setLoadingExistingGoal] = useState(true);
    const [existingGoalId, setExistingGoalId] = useState<string | null>(null);
    const [archivedGoals, setArchivedGoals] = useState<NonNullable<ExistingGoalResponse["archivedGoals"]>>([]);
    const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
    const [result, setResult] = useState<GoalResult | null>(null);

    const selectedDist = DISTANCES.find((d) => d.value === distance);
    const targetTimeSeconds = hasTargetTime
        ? targetHours * 3600 + targetMinutes * 60 + targetSeconds
        : undefined;

    useEffect(() => {
        let cancelled = false;

        async function loadExistingGoal() {
            try {
                const res = await fetch("/api/onboarding/goal");
                if (!res.ok) return;

                const data = (await res.json()) as ExistingGoalResponse;
                if (cancelled) return;
                setArchivedGoals(data.archivedGoals ?? []);
                if (!data.goal) return;

                setExistingGoalId(data.goal.id);
                setDistance(data.goal.distance);
                setTargetDate(data.goal.targetDate);

                const secs = data.goal.targetTimeSeconds ?? 0;
                if (secs > 0) {
                    setHasTargetTime(true);
                    setTargetHours(Math.floor(secs / 3600));
                    setTargetMinutes(Math.floor((secs % 3600) / 60));
                    setTargetSeconds(secs % 60);
                } else {
                    setHasTargetTime(false);
                }
            } finally {
                if (!cancelled) setLoadingExistingGoal(false);
            }
        }

        loadExistingGoal();
        return () => {
            cancelled = true;
        };
    }, []);

    async function handleSubmit() {
        if (!distance || !targetDate) return;
        const replacingExisting = Boolean(existingGoalId);
        if (replacingExisting) {
            const confirmed = window.confirm(
                "Replace your current goal with this new one? You can still keep or delete archived goals."
            );
            if (!confirmed) return;
        }

        setSubmitting(true);
        setResult(null);
        try {
            const res = await fetch("/api/onboarding/goal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ distance, targetDate, targetTimeSeconds }),
            });
            const data = (await res.json()) as GoalResult;
            setResult(data);
            if (data.ok) {
                setExistingGoalId(data.goalId ?? existingGoalId);
                setTimeout(() => router.push("/dashboard"), 1200);
            }
        } catch {
            setResult({ error: "Failed to save goal." });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDeleteGoal(goalId: string) {
        const confirmed = window.confirm("Delete this old goal permanently?");
        if (!confirmed) return;
        setDeletingGoalId(goalId);
        try {
            const res = await fetch("/api/onboarding/goal", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goalId }),
            });
            if (!res.ok) return;
            setArchivedGoals((prev) => prev.filter((g) => g.id !== goalId));
        } finally {
            setDeletingGoalId(null);
        }
    }

    async function handleDeleteArchived() {
        const confirmed = window.confirm("Delete all archived goals permanently?");
        if (!confirmed) return;
        setDeletingGoalId("all");
        try {
            const res = await fetch("/api/onboarding/goal", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deleteArchived: true }),
            });
            if (!res.ok) return;
            setArchivedGoals([]);
        } finally {
            setDeletingGoalId(null);
        }
    }

    async function handleDeleteCurrentGoal() {
        if (!existingGoalId) return;
        const confirmed = window.confirm("Delete your current active goal?");
        if (!confirmed) return;
        setDeletingGoalId(existingGoalId);
        try {
            const res = await fetch("/api/onboarding/goal", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goalId: existingGoalId }),
            });
            if (!res.ok) return;

            setExistingGoalId(null);
            setDistance(null);
            setTargetDate("");
            setHasTargetTime(false);
            setTargetHours(0);
            setTargetMinutes(0);
            setTargetSeconds(0);
            setResult(null);
        } finally {
            setDeletingGoalId(null);
        }
    }

    return (
        <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-12">
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                }}
            />

            <div className="relative z-10 w-full max-w-lg flex flex-col gap-6">
                <div>
                    <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Step 2 of 2</p>
                    <h1 className="text-2xl font-black tracking-tight">Set Your Goal</h1>
                    <p className="text-sm text-white/50 mt-1">
                        What are you training for? You can update this anytime.
                    </p>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="mt-3 text-xs text-white/50 hover:text-white/80 transition"
                    >
                        ← Back to Dashboard
                    </button>
                </div>

                {loadingExistingGoal && (
                    <div className="border border-white/10 rounded-xl p-3 text-xs text-white/40">
                        Loading current goal...
                    </div>
                )}

                {existingGoalId && (
                    <button
                        onClick={handleDeleteCurrentGoal}
                        disabled={deletingGoalId !== null}
                        className="self-start text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                    >
                        Delete current goal
                    </button>
                )}

                {archivedGoals.length > 0 && (
                    <div className="border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs text-white/40 uppercase tracking-widest">Archived Goals</p>
                            <button
                                onClick={handleDeleteArchived}
                                disabled={deletingGoalId !== null}
                                className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                            >
                                Delete all
                            </button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {archivedGoals.map((g) => (
                                <div key={g.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
                                    <div>
                                        <p className="text-sm text-white/80">{g.distance}</p>
                                        <p className="text-xs text-white/40">{new Date(g.targetDate).toLocaleDateString()}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteGoal(g.id)}
                                        disabled={deletingGoalId !== null}
                                        className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                                    >
                                        {deletingGoalId === g.id ? "Deleting..." : "Delete"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Distance selector */}
                <div>
                    <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Distance</p>
                    <div className="grid grid-cols-2 gap-3">
                        {DISTANCES.map((d) => (
                            <button
                                key={d.value}
                                onClick={() => {
                                    setDistance(d.value);
                                    setTargetDate(""); // reset date when distance changes
                                }}
                                className={`border rounded-xl p-4 text-left transition ${distance === d.value
                                    ? "border-white bg-white/10"
                                    : "border-white/10 hover:border-white/30"
                                    }`}
                            >
                                <span className="text-2xl">{d.emoji}</span>
                                <p className="font-semibold mt-2">{d.label}</p>
                                <p className="text-xs text-white/40 mt-0.5">{d.minWeeks}+ weeks</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Target date */}
                {distance && (
                    <div>
                        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Race Date</p>
                        <input
                            type="date"
                            value={targetDate}
                            min={minDate(selectedDist?.minWeeks ?? 4)}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/50 transition"
                        />
                        {selectedDist && (
                            <p className="text-xs text-white/30 mt-2">
                                Minimum recommended: {selectedDist.minWeeks} weeks from today
                            </p>
                        )}
                    </div>
                )}

                {/* Target time goal */}
                {distance && (
                    <div>
                        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Time Goal</p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <button
                                onClick={() => setHasTargetTime(true)}
                                className={`border rounded-xl p-3 text-sm text-left transition ${hasTargetTime
                                        ? "border-white bg-white/10"
                                        : "border-white/10 hover:border-white/30"
                                    }`}
                            >
                                <p className="font-medium">🎯 I have a time goal</p>
                                <p className="text-xs text-white/40 mt-0.5">Set a target finish time</p>
                            </button>
                            <button
                                onClick={() => {
                                    setHasTargetTime(false);
                                    setTargetHours(0);
                                    setTargetMinutes(0);
                                    setTargetSeconds(0);
                                }}
                                className={`border rounded-xl p-3 text-sm text-left transition ${!hasTargetTime
                                        ? "border-white bg-white/10"
                                        : "border-white/10 hover:border-white/30"
                                    }`}
                            >
                                <p className="font-medium">🏁 Just finish</p>
                                <p className="text-xs text-white/40 mt-0.5">No specific time target</p>
                            </button>
                        </div>
                        {hasTargetTime && (
                            <>
                                <div className="flex gap-2 items-center">
                                    {distance === "Marathon" || distance === "Half Marathon" ? (
                                        <>
                                            <div className="flex-1">
                                                <p className="text-xs text-white/30 mb-1 text-center">Hours</p>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={9}
                                                    value={targetHours}
                                                    onChange={(e) => setTargetHours(Number(e.target.value))}
                                                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-white/50"
                                                />
                                            </div>
                                            <span className="text-white/40 mt-4">:</span>
                                        </>
                                    ) : null}
                                    <div className="flex-1">
                                        <p className="text-xs text-white/30 mb-1 text-center">Min</p>
                                        <input
                                            type="number"
                                            min={0}
                                            max={59}
                                            value={targetMinutes}
                                            onChange={(e) => setTargetMinutes(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-white/50"
                                        />
                                    </div>
                                    <span className="text-white/40 mt-4">:</span>
                                    <div className="flex-1">
                                        <p className="text-xs text-white/30 mb-1 text-center">Sec</p>
                                        <input
                                            type="number"
                                            min={0}
                                            max={59}
                                            value={targetSeconds}
                                            onChange={(e) => setTargetSeconds(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-white/50"
                                        />
                                    </div>
                                </div>
                                {targetTimeSeconds && targetTimeSeconds > 0 && (
                                    <p className="text-xs text-white/30 mt-2 text-center">
                                        Target: {formatTime(targetTimeSeconds)}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Feasibility result */}
                {result && !result.error && (
                    <div
                        className={`rounded-xl px-4 py-3 text-sm border ${result.feasible
                            ? "border-green-500/30 bg-green-500/5 text-green-300"
                            : "border-amber-500/30 bg-amber-500/5 text-amber-300"
                            }`}
                    >
                        {result.feasibilityNote}
                    </div>
                )}

                {result?.error && (
                    <p className="text-xs text-red-400 text-center">{result.error}</p>
                )}

                {/* Submit */}
                {distance && targetDate && (
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || result?.ok === true}
                        className="w-full rounded-xl bg-white text-black font-semibold py-3 text-sm transition hover:bg-white/90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {submitting
                            ? "Saving goal..."
                            : result?.ok
                                ? "✓ Goal saved! Heading to dashboard..."
                                : "Save goal →"}
                    </button>
                )}
            </div>
        </main>
    );
}
