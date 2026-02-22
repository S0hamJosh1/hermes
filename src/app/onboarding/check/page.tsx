"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMiles } from "@/lib/units";

type CheckResult = {
    sufficient: boolean;
    reason: string;
    stats: {
        totalRuns: number;
        weeksOfHistory: number;
        longestRunKm: number;
        missingReasons: string[];
    };
    calibratedProfile: {
        basePaceSecondsPerKm: number;
        thresholdPaceSecondsPerKm: number;
        weeklyCapacityKm: number;
        durabilityScore: number;
        consistencyScore: number;
        riskLevel: string;
        basePaceFormatted: string;
        thresholdPaceFormatted: string;
        consistencyFormatted: string;
        durabilityFormatted: string;
        dataPoints: number;
        weeksAnalyzed: number;
    } | null;
    error?: string;
};

type ConfirmState = "idle" | "loading" | "done" | "error";

export default function OnboardingCheckPage() {
    const router = useRouter();
    const [result, setResult] = useState<CheckResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirmState, setConfirmState] = useState<ConfirmState>("idle");

    useEffect(() => {
        fetch("/api/onboarding/check")
            .then((r) => r.json())
            .then((data) => setResult(data as CheckResult))
            .catch(() => setResult({ sufficient: false, reason: "Failed to load.", stats: { totalRuns: 0, weeksOfHistory: 0, longestRunKm: 0, missingReasons: [] }, calibratedProfile: null }))
            .finally(() => setLoading(false));
    }, []);

    async function handleConfirm() {
        setConfirmState("loading");
        try {
            const res = await fetch("/api/onboarding/confirm-calibration", { method: "POST" });
            if (res.ok) {
                setConfirmState("done");
                setTimeout(() => router.push("/onboarding/goal"), 800);
            } else {
                setConfirmState("error");
            }
        } catch {
            setConfirmState("error");
        }
    }

    return (
        <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
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
                <div>
                    <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Step 1 of 2</p>
                    <h1 className="text-2xl font-black tracking-tight">Calibration Check</h1>
                    <p className="text-sm text-white/50 mt-1">
                        Analyzing your Strava history to build your runner profile.
                    </p>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="border border-white/10 rounded-xl p-6 flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="text-sm text-white/60">Scanning your run history...</span>
                    </div>
                )}

                {/* Sufficient — show calibrated profile */}
                {!loading && result?.sufficient && result.calibratedProfile && (
                    <>
                        <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-2 h-2 rounded-full bg-green-400" />
                                <span className="text-sm text-green-300 font-medium">
                                    {result.stats.totalRuns} runs · {result.stats.weeksOfHistory} weeks of data
                                </span>
                            </div>
                            <p className="text-xs text-white/40 uppercase tracking-widest mb-3">
                                Your Calibrated Profile
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: "Easy Pace", value: result.calibratedProfile.basePaceFormatted },
                                    { label: "Threshold Pace", value: result.calibratedProfile.thresholdPaceFormatted },
                                    { label: "Weekly Volume", value: formatMiles(result.calibratedProfile.weeklyCapacityKm) },
                                    { label: "Risk Level", value: result.calibratedProfile.riskLevel.charAt(0).toUpperCase() + result.calibratedProfile.riskLevel.slice(1) },
                                    { label: "Consistency", value: result.calibratedProfile.consistencyFormatted },
                                    { label: "Durability", value: result.calibratedProfile.durabilityFormatted },
                                ].map(({ label, value }) => (
                                    <div key={label} className="border border-white/10 rounded-lg p-3">
                                        <p className="text-xs text-white/40 mb-1">{label}</p>
                                        <p className="text-sm font-semibold">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <p className="text-xs text-white/30 text-center">
                            These values are estimated from your history. The algorithm will refine them over time.
                        </p>

                        <button
                            onClick={handleConfirm}
                            disabled={confirmState === "loading" || confirmState === "done"}
                            className="w-full rounded-xl bg-white text-black font-semibold py-3 text-sm transition hover:bg-white/90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {confirmState === "loading"
                                ? "Saving profile..."
                                : confirmState === "done"
                                    ? "✓ Profile saved!"
                                    : "Looks good — continue →"}
                        </button>
                        {confirmState === "error" && (
                            <p className="text-xs text-red-400 text-center">Something went wrong. Try again.</p>
                        )}
                    </>
                )}

                {/* Not sufficient — route to bootcamp */}
                {!loading && result && !result.sufficient && (
                    <>
                        <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="text-sm text-amber-300 font-medium">Not enough data yet</span>
                            </div>
                            <p className="text-sm text-white/60 mb-4">
                                We need a bit more running history to calibrate your profile accurately.
                            </p>
                            <div className="flex flex-col gap-2">
                                {result.stats.missingReasons.map((reason, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm text-white/50">
                                        <span className="text-amber-500 mt-0.5">○</span>
                                        {reason}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border border-white/10 rounded-xl p-5 text-sm text-white/50">
                            <p className="font-medium text-white/70 mb-2">What happens next?</p>
                            <p>
                                We'll start a 7-day calibration period. Run normally — we'll track your pace,
                                volume, and consistency. You can complete calibration early once you have enough data.
                            </p>
                        </div>

                        <button
                            onClick={() => router.push("/onboarding/bootcamp")}
                            className="w-full rounded-xl bg-white text-black font-semibold py-3 text-sm transition hover:bg-white/90 active:scale-95"
                        >
                            Start 7-day calibration →
                        </button>
                    </>
                )}
            </div>
        </main>
    );
}
