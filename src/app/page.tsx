"use client";

import { useState } from "react";

type GenerateResponse = {
  ok: boolean;
  userId?: string;
  weeklyPlanId?: string;
  selectedPlanId?: string;
  weekNumber?: number;
  state?: string;
  totalVolumeKm?: number;
  wasRepaired?: boolean;
  repairsApplied?: number;
  softViolations?: number;
  workouts?: number;
  error?: string;
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as GenerateResponse;
      setResult(data);
    } catch (_err) {
      setResult({ ok: false, error: "Failed to call /api/plans/generate." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6">
      <div className="w-full max-w-xl rounded-xl border border-white/20 bg-white/5 p-6 text-white">
        <h1 className="text-center text-2xl font-semibold">Hermes Training OS</h1>
        <p className="mt-2 text-center text-sm text-white/70">
          Generate and persist a weekly plan using the core algorithm pipeline.
        </p>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Generating..." : "Generate Weekly Plan"}
          </button>
        </div>

        {result && (
          <div className="mt-6 rounded-md border border-white/20 bg-black/40 p-4 text-sm">
            {result.ok ? (
              <div className="space-y-1">
                <p className="font-semibold text-green-300">Plan generated successfully.</p>
                <p>User: {result.userId}</p>
                <p>Weekly Plan ID: {result.weeklyPlanId}</p>
                <p>Template Plan: {result.selectedPlanId}</p>
                <p>Week Number: {result.weekNumber}</p>
                <p>State: {result.state}</p>
                <p>Total Volume: {result.totalVolumeKm} km</p>
                <p>Workouts: {result.workouts}</p>
                <p>Repairs Applied: {result.repairsApplied}</p>
                <p>Soft Violations: {result.softViolations}</p>
              </div>
            ) : (
              <p className="font-semibold text-red-300">
                Error: {result.error ?? "Unknown error"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
