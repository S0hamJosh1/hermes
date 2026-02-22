"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FormData = {
    recordType: string;
    bodyPart: string;
    severity: number;
    description: string;
    daysOff: number;
};

type SubmitResult = {
    ok?: boolean;
    message?: string;
    error?: string;
    strike?: {
        escalated: boolean;
        strikeCount: number;
        forcedRecoveryDays: number;
    } | null;
    chronicWarning?: boolean;
};

const RECORD_TYPES = [
    { value: "injury", label: "Injury", emoji: "🩹", description: "Acute injury or strain" },
    { value: "pain", label: "Pain", emoji: "😣", description: "Persistent or recurring pain" },
    { value: "fatigue", label: "Fatigue", emoji: "😮‍💨", description: "Unusual tiredness or heaviness" },
    { value: "illness", label: "Illness", emoji: "🤒", description: "Sick, cold, flu, etc." },
];

const BODY_PARTS = [
    "Ankle", "Achilles", "Calf", "Shin", "Knee", "Hamstring",
    "Quad", "Hip", "Glute", "Groin", "Foot", "Plantar Fascia",
    "IT Band", "Lower Back", "Upper Back", "Shoulder", "General",
];

export default function HealthReportPage() {
    const router = useRouter();
    const [form, setForm] = useState<FormData>({
        recordType: "",
        bodyPart: "",
        severity: 5,
        description: "",
        daysOff: 0,
    });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);
    const [loading, setLoading] = useState(true);

    // Auth check
    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => {
                if (!r.ok) router.push("/");
                setLoading(false);
            })
            .catch(() => router.push("/"));
    }, [router]);

    const needsBodyPart = form.recordType === "injury" || form.recordType === "pain";
    const canSubmit = form.recordType && (!needsBodyPart || form.bodyPart);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;

        setSubmitting(true);
        setResult(null);

        try {
            const res = await fetch("/api/health/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recordType: form.recordType,
                    bodyPart: needsBodyPart ? form.bodyPart.toLowerCase() : undefined,
                    severity: form.severity,
                    description: form.description || undefined,
                    daysOff: form.daysOff,
                }),
            });
            const data = (await res.json()) as SubmitResult;
            setResult(data);
        } catch {
            setResult({ error: "Failed to submit report." });
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-pulse text-white/40">Loading...</div>
            </main>
        );
    }

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
                        <h1 className="text-2xl font-black tracking-tight">Report Health Issue</h1>
                        <p className="text-xs text-white/40 uppercase tracking-widest mt-0.5">
                            Hermes Health System
                        </p>
                    </div>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="text-xs text-white/40 hover:text-white/70 transition"
                    >
                        ← Dashboard
                    </button>
                </div>

                {/* Success/Error state */}
                {result && (
                    <div className={`rounded-xl p-5 ${result.error
                            ? "border border-red-500/30 bg-red-500/10"
                            : "border border-green-500/30 bg-green-500/10"
                        }`}>
                        {result.error ? (
                            <p className="text-sm text-red-300">{result.error}</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <p className="text-sm text-green-300">{result.message}</p>

                                {result.strike && (
                                    <div className="border-t border-green-500/20 pt-3">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-orange-400">⚠️</span>
                                            <span className="text-orange-300">
                                                Strike {result.strike.strikeCount}
                                                {result.strike.escalated && " (escalated)"}
                                            </span>
                                        </div>
                                        {result.strike.forcedRecoveryDays > 0 && (
                                            <p className="text-xs text-orange-300/70 mt-1">
                                                {result.strike.forcedRecoveryDays} forced recovery days applied.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {result.chronicWarning && (
                                    <div className="border-t border-green-500/20 pt-3">
                                        <p className="text-xs text-red-300">
                                            ⚠️ Chronic pattern detected — this body part has been reported 3+ times in 90 days.
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={() => router.push("/dashboard")}
                                    className="mt-2 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10"
                                >
                                    Back to Dashboard
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Form */}
                {!result?.ok && (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        {/* Record Type */}
                        <div className="border border-white/10 rounded-xl p-5">
                            <p className="text-xs text-white/40 uppercase tracking-widest mb-4">
                                What happened?
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {RECORD_TYPES.map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setForm({ ...form, recordType: type.value })}
                                        className={`rounded-lg border px-4 py-3 text-left transition ${form.recordType === type.value
                                                ? "border-white/40 bg-white/10"
                                                : "border-white/10 bg-white/5 hover:bg-white/10"
                                            }`}
                                    >
                                        <div className="text-lg mb-1">{type.emoji}</div>
                                        <div className="text-sm font-medium">{type.label}</div>
                                        <div className="text-xs text-white/40 mt-0.5">{type.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Body Part (conditional) */}
                        {needsBodyPart && (
                            <div className="border border-white/10 rounded-xl p-5">
                                <p className="text-xs text-white/40 uppercase tracking-widest mb-4">
                                    Where does it hurt?
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {BODY_PARTS.map((part) => (
                                        <button
                                            key={part}
                                            type="button"
                                            onClick={() => setForm({ ...form, bodyPart: part })}
                                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${form.bodyPart === part
                                                    ? "bg-white/20 text-white border border-white/40"
                                                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                                                }`}
                                        >
                                            {part}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Severity */}
                        {form.recordType && (
                            <div className="border border-white/10 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs text-white/40 uppercase tracking-widest">
                                        Severity
                                    </p>
                                    <span className={`text-lg font-bold ${form.severity >= 8
                                            ? "text-red-400"
                                            : form.severity >= 5
                                                ? "text-yellow-400"
                                                : "text-green-400"
                                        }`}>
                                        {form.severity}/10
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={10}
                                    value={form.severity}
                                    onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}
                                    className="w-full accent-white"
                                />
                                <div className="flex justify-between text-xs text-white/30 mt-2">
                                    <span>Minor</span>
                                    <span>Moderate</span>
                                    <span>Severe</span>
                                </div>

                                {/* Impact preview */}
                                <div className="mt-4 border-t border-white/10 pt-3">
                                    <p className="text-xs text-white/40 mb-2">Training impact:</p>
                                    <p className="text-xs text-white/60">
                                        {form.severity >= 8 && "🔴 Full rest required. All runs suspended."}
                                        {form.severity >= 6 && form.severity < 8 && "🟡 Reduced volume. Cut weekly mileage by 50%."}
                                        {form.severity >= 4 && form.severity < 6 && "🟠 Reduced intensity. No tempo/interval work."}
                                        {form.severity < 4 && "🟢 Monitor only. No plan modifications."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {form.recordType && (
                            <div className="border border-white/10 rounded-xl p-5">
                                <p className="text-xs text-white/40 uppercase tracking-widest mb-3">
                                    Details (optional)
                                </p>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Describe what happened, when it started, etc."
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-white/30"
                                />
                            </div>
                        )}

                        {/* Submit */}
                        {canSubmit && (
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-xl bg-white text-black px-4 py-4 text-sm font-bold transition hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? "Submitting..." : "Submit Health Report"}
                            </button>
                        )}
                    </form>
                )}
            </div>
        </main>
    );
}
