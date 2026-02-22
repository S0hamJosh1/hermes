"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type BootcampStatus = {
    alreadyCompleted?: boolean;
    daysElapsed: number;
    daysTotal: number;
    runsLogged: number;
    sufficient: boolean;
    canComplete: boolean;
    missingReasons: string[];
};

export default function BootcampPage() {
    const router = useRouter();
    const [status, setStatus] = useState<BootcampStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function fetchStatus() {
        fetch("/api/onboarding/bootcamp/status")
            .then((r) => r.json())
            .then((data) => {
                const s = data as BootcampStatus;
                if (s.alreadyCompleted) {
                    router.push("/onboarding/goal");
                    return;
                }
                setStatus(s);
            })
            .catch(() => setError("Failed to load bootcamp status."))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        fetchStatus();
        // Poll every 30s so the page updates as the user syncs runs
        const interval = setInterval(fetchStatus, 30_000);
        return () => clearInterval(interval);
    }, []);

    async function handleComplete() {
        setCompleting(true);
        setError(null);
        try {
            const res = await fetch("/api/onboarding/bootcamp/complete", { method: "POST" });
            if (res.ok) {
                router.push("/onboarding/goal");
            } else {
                const data = await res.json() as { error?: string };
                setError(data.error ?? "Something went wrong.");
            }
        } catch {
            setError("Failed to complete calibration.");
        } finally {
            setCompleting(false);
        }
    }

    const progressPct = status ? Math.min((status.daysElapsed / status.daysTotal) * 100, 100) : 0;

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
                <div>
                    <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Step 1 of 2</p>
                    <h1 className="text-2xl font-black tracking-tight">Calibration Period</h1>
                    <p className="text-sm text-white/50 mt-1">
                        Run normally for 7 days. We'll build your profile from real data.
                    </p>
                </div>

                {loading && (
                    <div className="border border-white/10 rounded-xl p-6 flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="text-sm text-white/60">Loading status...</span>
                    </div>
                )}

                {status && (
                    <>
                        {/* Progress */}
                        <div className="border border-white/10 rounded-xl p-5 flex flex-col gap-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-white/60">Day {status.daysElapsed} of {status.daysTotal}</span>
                                <span className="text-white/60">{status.runsLogged} run{status.runsLogged !== 1 ? "s" : ""} logged</span>
                            </div>
                            {/* Progress bar */}
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white rounded-full transition-all duration-500"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>

                            {/* What we're measuring */}
                            <div className="border-t border-white/10 pt-4">
                                <p className="text-xs text-white/40 uppercase tracking-widest mb-3">
                                    What we're measuring
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        "Easy run pace",
                                        "Weekly volume",
                                        "Consistency",
                                        "Long run ability",
                                        "Recovery patterns",
                                        "Risk profile",
                                    ].map((item) => (
                                        <div key={item} className="flex items-center gap-2 text-xs text-white/40">
                                            <span className="w-1 h-1 rounded-full bg-white/30 flex-shrink-0" />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Missing reasons (if not yet sufficient) */}
                        {!status.sufficient && status.missingReasons.length > 0 && (
                            <div className="border border-white/10 rounded-xl p-4">
                                <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Still needed</p>
                                <div className="flex flex-col gap-2">
                                    {status.missingReasons.map((r, i) => (
                                        <p key={i} className="text-xs text-white/50">{r}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Sync reminder */}
                        <p className="text-xs text-white/30 text-center">
                            Sync your activities from the dashboard to update this page.
                        </p>

                        {/* Complete button */}
                        {status.canComplete && (
                            <>
                                <button
                                    onClick={handleComplete}
                                    disabled={completing}
                                    className="w-full rounded-xl bg-white text-black font-semibold py-3 text-sm transition hover:bg-white/90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {completing ? "Calibrating..." : status.sufficient ? "Complete calibration →" : "Complete with available data →"}
                                </button>
                                {!status.sufficient && (
                                    <p className="text-xs text-white/30 text-center -mt-3">
                                        7 days elapsed — you can calibrate now even with limited data.
                                    </p>
                                )}
                            </>
                        )}

                        {error && (
                            <p className="text-xs text-red-400 text-center">{error}</p>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
