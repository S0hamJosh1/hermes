"use client";

import { kmToMiles } from "@/lib/units";

type WeeklyVolumePoint = {
    weekStartDate: string;
    plannedKm: number | null;
    actualKm: number | null;
    compliance: number | null;
    healthIssuesCount: number;
    endingState: string | null;
};

function formatWeekLabel(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

function createPlaceholderWeeks(): WeeklyVolumePoint[] {
    return Array.from({ length: 8 }, (_, index) => ({
        weekStartDate: `placeholder-${index}`,
        plannedKm: null,
        actualKm: null,
        compliance: null,
        healthIssuesCount: 0,
        endingState: null,
    }));
}

export function WeeklyVolumeChart({ points }: { points: WeeklyVolumePoint[] }) {
    const hasData = points.length > 0;
    const chartPoints = hasData ? points.slice(-8) : createPlaceholderWeeks();
    const maxKm = Math.max(
        1,
        ...chartPoints.flatMap((point) => [point.plannedKm ?? 0, point.actualKm ?? 0]),
    );
    const hitPlanCount = chartPoints.filter(
        (point) =>
            point.plannedKm !== null &&
            point.actualKm !== null &&
            point.actualKm >= point.plannedKm,
    ).length;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-white/45">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm bg-white/15" />
                        Planned
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm bg-cyan-300/80" />
                        Actual
                    </span>
                </div>
                <span>{hasData ? `${hitPlanCount}/${chartPoints.length} weeks hit plan` : "Awaiting weekly summaries"}</span>
            </div>

            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-4 pb-4 pt-6">
                <div className="pointer-events-none absolute inset-x-4 bottom-10 top-6 flex flex-col justify-between">
                    {Array.from({ length: 4 }, (_, index) => (
                        <div key={index} className="border-t border-dashed border-white/8" />
                    ))}
                </div>

                <div className="relative z-10 flex h-44 items-end gap-3">
                    {chartPoints.map((point, index) => {
                        const plannedHeight = ((point.plannedKm ?? 0) / maxKm) * 100;
                        const actualHeight = ((point.actualKm ?? 0) / maxKm) * 100;
                        const complianceLabel =
                            point.compliance !== null ? `${Math.round(point.compliance)}%` : "--";
                        const label = point.weekStartDate.startsWith("placeholder")
                            ? `W${index + 1}`
                            : formatWeekLabel(point.weekStartDate);

                        return (
                            <div key={point.weekStartDate} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                                <div className="flex h-36 w-full items-end justify-center gap-1.5 rounded-xl border border-white/6 bg-black/10 px-2 pb-2">
                                    <div
                                        className={`w-3 rounded-t-md ${hasData ? "bg-white/15" : "bg-white/8"}`}
                                        style={{ height: `${Math.max(plannedHeight, point.plannedKm ? 10 : 12)}%` }}
                                        title={`Planned ${kmToMiles(point.plannedKm ?? 0).toFixed(1)} mi`}
                                    />
                                    <div
                                        className={`w-3 rounded-t-md ${hasData
                                            ? "bg-cyan-300/80 shadow-[0_0_18px_rgba(103,232,249,0.25)]"
                                            : "bg-cyan-200/20"
                                            }`}
                                        style={{ height: `${Math.max(actualHeight, point.actualKm ? 10 : 12)}%` }}
                                        title={`Actual ${kmToMiles(point.actualKm ?? 0).toFixed(1)} mi`}
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-[11px] font-medium text-white/65">{label}</p>
                                    <p className="text-[10px] text-white/35">{complianceLabel}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {hasData ? (
                <div className="grid grid-cols-2 gap-3 text-xs text-white/45 sm:grid-cols-4">
                    {chartPoints.slice(-4).map((point) => (
                        <div key={`${point.weekStartDate}-meta`} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">
                                {formatWeekLabel(point.weekStartDate)}
                            </p>
                            <p className="mt-1 text-white/70">
                                {kmToMiles(point.actualKm ?? 0).toFixed(1)} / {kmToMiles(point.plannedKm ?? 0).toFixed(1)} mi
                            </p>
                            <p className="text-[10px] text-white/30">
                                {point.healthIssuesCount} health flags
                                {point.endingState ? ` · ${point.endingState}` : ""}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-[1.15rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/45">
                    Weekly summaries have not been generated yet, so this chart stays visible as an empty shell.
                </div>
            )}
        </div>
    );
}
