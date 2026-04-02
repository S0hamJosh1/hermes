"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatMiles, formatPacePerMile, kmToMiles } from "@/lib/units";
import { WeeklyVolumeChart } from "@/components/dashboard/WeeklyVolumeChart";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";

type SyncResult = {
    synced?: number;
    skipped?: number;
    total?: number;
    error?: string;
    recalibrated?: boolean;
};

type ProfileData = {
    currentState: string;
    basePaceSecondsPerKm: number;
    thresholdPaceSecondsPerKm: number;
    weeklyCapacityKm: number;
    durabilityScore: number;
    consistencyScore: number;
    riskLevel: string;
    planLevelOffset: number;
    planLevelMode: "auto" | "user_override";
    primaryGoalDistance: string | null;
    primaryGoalDate: string | null;
    goalTimeSeconds: number | null;
};

type HealthSummary = {
    activeInjuries: {
        id: string;
        bodyPart: string;
        severity: number;
        recordDate: string;
        description: string | null;
    }[];
    activeStrikes: number;
    recentRecords: {
        id: string;
        recordType: string;
        bodyPart: string | null;
        severity: number | null;
        recordDate: string;
    }[];
};

type ComplianceData = {
    currentWeekCompliance: number | null;
    last4WeekAverage: number | null;
    totalPlannedKm: number | null;
    totalActualKm: number | null;
    trend: "improving" | "declining" | "stable" | "unknown";
    weeklyTrend: {
        weekStartDate: string;
        plannedKm: number | null;
        actualKm: number | null;
        compliance: number | null;
        healthIssuesCount: number;
        endingState: string | null;
    }[];
};

type DashboardData = {
    profile: ProfileData | null;
    health: HealthSummary;
    compliance: ComplianceData;
    activityHeatmap: {
        date: string;
        distanceKm: number;
        durationMinutes: number;
        runCount: number;
    }[];
    performance: {
        "5K": { best: Effort | null; secondBest: Effort | null };
        "10K": { best: Effort | null; secondBest: Effort | null };
        "Half Marathon": { best: Effort | null; secondBest: Effort | null };
        "Marathon": { best: Effort | null; secondBest: Effort | null };
    };
};

type Effort = {
    timeSeconds: number;
    date: string;
    distanceKm: number;
};

const STATE_COLORS: Record<string, string> = {
    Stable: "bg-green-400",
    Slump: "bg-yellow-400",
    Probe: "bg-blue-400",
    Rebuild: "bg-cyan-400",
    Overreach: "bg-red-400",
    "Injury Watch": "bg-orange-400",
    "Injury Protection": "bg-red-500",
    "Override Active": "bg-purple-400",
    Taper: "bg-indigo-400",
};

function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

function planPreferenceBadge(profile: ProfileData): {
    label: string;
    className: string;
} {
    if (profile.planLevelMode !== "user_override" || profile.planLevelOffset === 0) {
        return {
            label: "Plan: Auto",
            className: "bg-white/10 text-white/70",
        };
    }

    if (profile.planLevelOffset > 0) {
        return {
            label: `Plan: Harder (+${profile.planLevelOffset})`,
            className: "bg-orange-500/20 text-orange-300",
        };
    }

    return {
        label: `Plan: Easier (${profile.planLevelOffset})`,
        className: "bg-sky-500/20 text-sky-300",
    };
}

export default function Dashboard() {
    const router = useRouter();
    const [dashData, setDashData] = useState<DashboardData | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchDashboard = useCallback(async () => {
        try {
            const [meRes, dashRes] = await Promise.all([
                fetch("/api/auth/me"),
                fetch("/api/dashboard"),
            ]);
            if (!meRes.ok) {
                router.push("/");
                return;
            }
            if (dashRes.ok) {
                const data = (await dashRes.json()) as DashboardData;
                setDashData(data);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const [recalibrating, setRecalibrating] = useState(false);

    async function handleSync() {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch("/api/sync/strava", { method: "POST" });
            const data = (await res.json()) as SyncResult;
            setSyncResult(data);
            // Refresh dashboard data after sync
            fetchDashboard();
        } catch {
            setSyncResult({ error: "Failed to reach sync endpoint." });
        } finally {
            setSyncing(false);
        }
    }

    async function handleRecalibrate() {
        setRecalibrating(true);
        setSyncResult(null);
        try {
            const res = await fetch("/api/recalibrate", { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                setSyncResult({ error: data.error ?? "Recalibration failed." });
            } else {
                setSyncResult({ recalibrated: true });
                fetchDashboard();
            }
        } catch {
            setSyncResult({ error: "Failed to reach recalibrate endpoint." });
        } finally {
            setRecalibrating(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse text-white/40">Loading...</div>
            </main>
        );
    }

    const profile = dashData?.profile;
    const health = dashData?.health;
    const compliance = dashData?.compliance;
    const weeklyTrend = compliance?.weeklyTrend ?? [];
    const activityHeatmap = dashData?.activityHeatmap ?? [];
    const performance = dashData?.performance;
    const preference = profile ? planPreferenceBadge(profile) : null;

    return (
        <main className="text-white flex flex-col items-center px-2 py-2">
            <div className="w-full max-w-6xl flex flex-col gap-6">
                {/* Runner State + Profile */}
                {profile && (
                    <div className="glass-card p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full ${STATE_COLORS[profile.currentState] ?? "bg-white/40"}`} />
                                <span className="text-sm font-medium">{profile.currentState}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {preference && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${preference.className}`}>
                                        {preference.label}
                                    </span>
                                )}
                                {profile.riskLevel && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${profile.riskLevel === "low"
                                        ? "bg-green-500/20 text-green-400"
                                        : profile.riskLevel === "high"
                                            ? "bg-red-500/20 text-red-400"
                                            : "bg-yellow-500/20 text-yellow-400"
                                        }`}>
                                        {profile.riskLevel} risk
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="glass-card p-3">
                                <p className="text-xs text-white/40 mb-1">Easy Pace</p>
                                <p className="text-sm font-medium">{formatPacePerMile(profile.basePaceSecondsPerKm)}</p>
                            </div>
                            <div className="glass-card p-3">
                                <p className="text-xs text-white/40 mb-1">Threshold</p>
                                <p className="text-sm font-medium">{formatPacePerMile(profile.thresholdPaceSecondsPerKm)}</p>
                            </div>
                            <div className="glass-card p-3">
                                <p className="text-xs text-white/40 mb-1">Weekly Capacity</p>
                                <p className="text-sm font-medium">{formatMiles(profile.weeklyCapacityKm)}</p>
                            </div>
                            <div className="glass-card p-3">
                                <p className="text-xs text-white/40 mb-1">Consistency</p>
                                <p className="text-sm font-medium">{Math.round(profile.consistencyScore * 100)}%</p>
                            </div>
                        </div>

                        {/* Goal */}
                        {profile.primaryGoalDistance && (
                            <div className="border-t border-white/10 pt-3">
                                <p className="text-xs text-white/40 mb-1">Current Goal</p>
                                <p className="text-sm font-medium">
                                    {profile.primaryGoalDistance}
                                    {profile.primaryGoalDate && (
                                        <span className="text-white/50 ml-2">
                                            → {profile.primaryGoalDate}
                                        </span>
                                    )}
                                </p>
                                <button
                                    onClick={() => router.push("/onboarding/goal")}
                                    className="mt-2 text-xs text-white/50 hover:text-white/80 transition"
                                >
                                    Edit goal →
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Health & Injury Status */}
                <div className="glass-card p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-white/40 uppercase tracking-widest">
                            Health Status
                        </p>
                        {health && health.activeStrikes > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                                {health.activeStrikes} strike{health.activeStrikes !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>

                    {health && health.activeInjuries.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {health.activeInjuries.map((injury) => (
                                <div
                                    key={injury.id}
                                    className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3"
                                >
                                    <div>
                                        <p className="text-sm text-red-300 font-medium">
                                            {injury.bodyPart}
                                        </p>
                                        {injury.description && (
                                            <p className="text-xs text-red-300/60 mt-0.5">{injury.description}</p>
                                        )}
                                    </div>
                                    <span className="text-xs text-red-400">
                                        Severity {injury.severity}/10
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 text-sm text-green-400/80">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            No active injuries
                        </div>
                    )}

                    <button
                        onClick={() => router.push("/health/report")}
                        className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10"
                    >
                        Report Injury or Pain
                    </button>
                </div>

                {/* Compliance */}
                {compliance && compliance.currentWeekCompliance !== null && (
                    <div className="glass-card p-5 flex flex-col gap-4">
                        <p className="text-xs text-blue-200/40 uppercase tracking-widest">
                            Compliance
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="glass-card p-3">
                                <p className="text-xs text-white/40 mb-1">This Week</p>
                                <p className={`text-lg font-bold ${compliance.currentWeekCompliance >= 80
                                    ? "text-green-400"
                                    : compliance.currentWeekCompliance >= 60
                                        ? "text-yellow-400"
                                        : "text-red-400"
                                    }`}>
                                    {Math.round(compliance.currentWeekCompliance)}%
                                </p>
                            </div>
                            <div className="glass-card p-3">
                                <p className="text-xs text-white/40 mb-1">4-Week Avg</p>
                                <p className="text-lg font-bold text-white/80">
                                    {compliance.last4WeekAverage !== null
                                        ? `${Math.round(compliance.last4WeekAverage)}%`
                                        : "—"}
                                </p>
                            </div>
                        </div>
                        {compliance.totalPlannedKm !== null && compliance.totalActualKm !== null && (
                            <div className="text-xs text-white/40">
                                {kmToMiles(compliance.totalActualKm).toFixed(1)} mi actual / {kmToMiles(compliance.totalPlannedKm).toFixed(1)} mi planned this week
                            </div>
                        )}
                    </div>
                )}

                {(weeklyTrend.length > 0 || activityHeatmap.length > 0) && (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                        {weeklyTrend.length > 0 && (
                            <div className="glass-card p-5 flex flex-col gap-4">
                                <div>
                                    <p className="text-xs text-blue-200/40 uppercase tracking-widest">
                                        Volume Trend
                                    </p>
                                    <p className="mt-1 text-sm text-white/55">
                                        Planned vs actual mileage over the last {weeklyTrend.length} weeks
                                    </p>
                                </div>
                                <WeeklyVolumeChart points={weeklyTrend} />
                            </div>
                        )}

                        {activityHeatmap.length > 0 && (
                            <div className="glass-card p-5 flex flex-col gap-4">
                                <div>
                                    <p className="text-xs text-blue-200/40 uppercase tracking-widest">
                                        Activity Heatmap
                                    </p>
                                    <p className="mt-1 text-sm text-white/55">
                                        A quick read on how consistently you have been showing up lately
                                    </p>
                                </div>
                                <ActivityHeatmap days={activityHeatmap} />
                            </div>
                        )}
                    </div>
                )}

                {/* Strava Sync */}
                <div className="glass-card p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-sm text-white/70">Connected to Strava</span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSync}
                            disabled={syncing || recalibrating}
                            className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {syncing ? "Syncing..." : "Sync Activities"}
                        </button>
                        <button
                            onClick={handleRecalibrate}
                            disabled={syncing || recalibrating}
                            title="Fix weekly capacity if it looks wrong (e.g. best efforts correct but mileage low)"
                            className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {recalibrating ? "Recalibrating..." : "Recalibrate"}
                        </button>
                    </div>

                    {syncResult && (
                        <div
                            className={`rounded-lg px-4 py-3 text-sm ${syncResult.error
                                ? "border border-red-500/30 bg-red-500/10 text-red-300"
                                : "border border-green-500/30 bg-green-500/10 text-green-300"
                                }`}
                        >
                            {syncResult.error ? (
                                <span>{syncResult.error}</span>
                            ) : syncResult.recalibrated ? (
                                <span>✓ Weekly capacity updated from your activities</span>
                            ) : (
                                <span>
                                    ✓ Synced <strong>{syncResult.synced}</strong> run
                                    {syncResult.synced !== 1 ? "s" : ""} · Skipped{" "}
                                    <strong>{syncResult.skipped}</strong> non-run
                                    {syncResult.skipped !== 1 ? "s" : ""}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {performance && (
                    <div className="glass-card p-5 flex flex-col gap-4">
                        <p className="text-xs text-blue-200/40 uppercase tracking-widest">
                            Strava Best Efforts
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                            {(["5K", "10K", "Half Marathon", "Marathon"] as const).map((d) => {
                                const effort = performance[d];
                                const displayEffort = effort.best ?? effort.secondBest;
                                return (
                                    <div key={d} className="glass-card px-3 py-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-white/70">{d}</span>
                                            {displayEffort ? (
                                                <span className="text-white font-medium">
                                                    {formatTime(displayEffort.timeSeconds)}
                                                </span>
                                            ) : (
                                                <span className="text-white/30">No effort yet</span>
                                            )}
                                        </div>
                                        {displayEffort && (
                                            <p className="text-xs text-white/40 mt-1">
                                                Using {displayEffort === effort.best ? "best" : "2nd best"} from{" "}
                                                {new Date(displayEffort.date).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
}
