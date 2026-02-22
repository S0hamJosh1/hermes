"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatMiles, formatPacePerMile, kmToMiles } from "@/lib/units";

type SyncResult = {
    synced?: number;
    skipped?: number;
    total?: number;
    error?: string;
};

type MeResult = {
    authenticated: boolean;
    stravaUsername?: string;
    userId?: string;
};

type ProfileData = {
    currentState: string;
    basePaceSecondsPerKm: number;
    thresholdPaceSecondsPerKm: number;
    weeklyCapacityKm: number;
    durabilityScore: number;
    consistencyScore: number;
    riskLevel: string;
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
};

type DashboardData = {
    profile: ProfileData | null;
    health: HealthSummary;
    compliance: ComplianceData;
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

export default function Dashboard() {
    const router = useRouter();
    const [me, setMe] = useState<MeResult | null>(null);
    const [dashData, setDashData] = useState<DashboardData | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);
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
            const meData = (await meRes.json()) as MeResult;
            setMe(meData);
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

    async function handleLogout() {
        setLoggingOut(true);
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-pulse text-white/40">Loading...</div>
            </main>
        );
    }

    const profile = dashData?.profile;
    const health = dashData?.health;
    const compliance = dashData?.compliance;
    const performance = dashData?.performance;

    return (
        <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-10">
            {/* Background grid */}
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
                        <h1 className="text-2xl font-black tracking-tight">HERMES</h1>
                        <p className="text-xs text-white/40 uppercase tracking-widest mt-0.5">
                            Training OS
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {me?.stravaUsername && (
                            <span className="text-xs text-white/40">
                                {me.stravaUsername}
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className="text-xs text-white/40 hover:text-white/70 transition disabled:opacity-50"
                        >
                            {loggingOut ? "Logging out..." : "Logout →"}
                        </button>
                    </div>
                </div>

                {/* Runner State + Profile */}
                {profile && (
                    <div className="border border-white/10 rounded-xl p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full ${STATE_COLORS[profile.currentState] ?? "bg-white/40"}`} />
                                <span className="text-sm font-medium">{profile.currentState}</span>
                            </div>
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

                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/5 rounded-lg p-3">
                                <p className="text-xs text-white/40 mb-1">Easy Pace</p>
                                <p className="text-sm font-medium">{formatPacePerMile(profile.basePaceSecondsPerKm)}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3">
                                <p className="text-xs text-white/40 mb-1">Threshold</p>
                                <p className="text-sm font-medium">{formatPacePerMile(profile.thresholdPaceSecondsPerKm)}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3">
                                <p className="text-xs text-white/40 mb-1">Weekly Capacity</p>
                                <p className="text-sm font-medium">{formatMiles(profile.weeklyCapacityKm)}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3">
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
                                            → {new Date(profile.primaryGoalDate).toLocaleDateString()}
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

                {/* Quick Nav */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => router.push("/plan")}
                        className="rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                    >
                        <p className="text-xs text-white/40 mb-1">📋</p>
                        <p className="text-sm font-medium">Weekly Plan</p>
                        <p className="text-xs text-white/30 mt-0.5">View training schedule</p>
                    </button>
                    <button
                        onClick={() => router.push("/roadmap")}
                        className="rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                    >
                        <p className="text-xs text-white/40 mb-1">🗺️</p>
                        <p className="text-sm font-medium">Roadmap</p>
                        <p className="text-xs text-white/30 mt-0.5">Phases & milestones</p>
                    </button>
                    <button
                        onClick={() => router.push("/chat")}
                        className="rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                    >
                        <p className="text-xs text-white/40 mb-1">💬</p>
                        <p className="text-sm font-medium">Hermes Chat</p>
                        <p className="text-xs text-white/30 mt-0.5">Your running assistant</p>
                    </button>
                    <button
                        onClick={() => router.push("/onboarding/goal")}
                        className="rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                    >
                        <p className="text-xs text-white/40 mb-1">🎯</p>
                        <p className="text-sm font-medium">Goal Settings</p>
                        <p className="text-xs text-white/30 mt-0.5">Change race & target</p>
                    </button>
                </div>

                {/* Health & Injury Status */}
                <div className="border border-white/10 rounded-xl p-5 flex flex-col gap-4">
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
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10"
                    >
                        Report Injury or Pain
                    </button>
                </div>

                {/* Compliance */}
                {compliance && compliance.currentWeekCompliance !== null && (
                    <div className="border border-white/10 rounded-xl p-5 flex flex-col gap-4">
                        <p className="text-xs text-white/40 uppercase tracking-widest">
                            Compliance
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/5 rounded-lg p-3">
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
                            <div className="bg-white/5 rounded-lg p-3">
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

                {/* Strava Sync */}
                <div className="border border-white/10 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-sm text-white/70">Connected to Strava</span>
                    </div>

                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {syncing ? "Syncing from Strava..." : "Sync Activities"}
                    </button>

                    {syncResult && (
                        <div
                            className={`rounded-lg px-4 py-3 text-sm ${syncResult.error
                                ? "border border-red-500/30 bg-red-500/10 text-red-300"
                                : "border border-green-500/30 bg-green-500/10 text-green-300"
                                }`}
                        >
                            {syncResult.error ? (
                                <span>{syncResult.error}</span>
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
                    <div className="border border-white/10 rounded-xl p-5 flex flex-col gap-4">
                        <p className="text-xs text-white/40 uppercase tracking-widest">
                            Strava Best Efforts
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                            {(["5K", "10K", "Half Marathon", "Marathon"] as const).map((d) => {
                                const effort = performance[d];
                                return (
                                    <div key={d} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-white/70">{d}</span>
                                            {effort.secondBest ? (
                                                <span className="text-white font-medium">
                                                    {formatTime(effort.secondBest.timeSeconds)}
                                                </span>
                                            ) : effort.best ? (
                                                <span className="text-white/80 font-medium">
                                                    {formatTime(effort.best.timeSeconds)}
                                                </span>
                                            ) : (
                                                <span className="text-white/30">No effort yet</span>
                                            )}
                                        </div>
                                        {(effort.secondBest || effort.best) && (
                                            <p className="text-xs text-white/40 mt-1">
                                                Using {effort.secondBest ? "2nd best" : "best"} from{" "}
                                                {new Date((effort.secondBest ?? effort.best)!.date).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Systems Status */}
                <div className="border border-white/10 rounded-xl p-5">
                    <p className="text-xs text-white/40 uppercase tracking-widest mb-4">
                        Systems Online
                    </p>
                    <div className="flex flex-col gap-2">
                        {[
                            { name: "Strava OAuth & Sync", status: true },
                            { name: "Auto-Calibration", status: true },
                            { name: "Bootcamp Flow", status: true },
                            { name: "Plan Generation Pipeline", status: true },
                            { name: "State Machine (9 states)", status: true },
                            { name: "Validator (8 safety rules)", status: true },
                            { name: "Auto-Repair Engine", status: true },
                            { name: "Health & Injury Tracking", status: true },
                            { name: "Compliance System", status: true },
                        ].map((item) => (
                            <div
                                key={item.name}
                                className="flex items-center gap-3 text-sm text-white/60"
                            >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.status ? "bg-green-400" : "bg-white/20"}`} />
                                {item.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
