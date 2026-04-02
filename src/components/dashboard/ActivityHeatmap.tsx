"use client";

import { kmToMiles } from "@/lib/units";

type ActivityDay = {
    date: string;
    distanceKm: number;
    durationMinutes: number;
    runCount: number;
};

const DAY_LABELS = ["Mon", "Wed", "Fri", "Sun"];

function getColor(distanceKm: number): string {
    const distanceMiles = kmToMiles(distanceKm);
    if (distanceMiles === 0) return "bg-white/5";
    if (distanceMiles < 3) return "bg-emerald-500/25";
    if (distanceMiles < 6) return "bg-emerald-400/45";
    if (distanceMiles < 10) return "bg-cyan-300/65";
    return "bg-sky-300/90";
}

function formatMonth(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", { month: "short" });
}

export function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
    const byDate = new Map(days.map((day) => [day.date, day]));
    const firstDate = new Date(`${days[0].date}T00:00:00`);
    const lastDate = new Date(`${days[days.length - 1].date}T00:00:00`);

    const gridStart = new Date(firstDate);
    gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));

    const gridEnd = new Date(lastDate);
    gridEnd.setDate(gridEnd.getDate() + (6 - ((gridEnd.getDay() + 6) % 7)));

    const weeks: ({ date: string; distanceKm: number; durationMinutes: number; runCount: number } | null)[][] = [];
    const cursor = new Date(gridStart);

    while (cursor <= gridEnd) {
        const week: ({ date: string; distanceKm: number; durationMinutes: number; runCount: number } | null)[] = [];
        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            const dateKey = cursor.toISOString().slice(0, 10);
            week.push(byDate.get(dateKey) ?? null);
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }

    const totalMiles = days.reduce((sum, day) => sum + kmToMiles(day.distanceKm), 0);
    const activeDays = days.filter((day) => day.runCount > 0).length;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-white/45">
                <span>{activeDays} active days in the last 12 weeks</span>
                <span>{totalMiles.toFixed(0)} total miles</span>
            </div>

            <div className="overflow-x-auto pb-1">
                <div className="inline-flex min-w-full gap-2">
                    <div className="flex flex-col justify-between py-7 text-[10px] uppercase tracking-[0.18em] text-white/25">
                        {DAY_LABELS.map((label) => (
                            <span key={label}>{label}</span>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-1 text-[10px] uppercase tracking-[0.18em] text-white/25">
                            {weeks.map((week, index) => {
                                const monthLabel = week.find(Boolean)?.date;
                                const previousLabel = weeks[index - 1]?.find(Boolean)?.date;
                                const showLabel =
                                    monthLabel &&
                                    (!previousLabel || formatMonth(monthLabel) !== formatMonth(previousLabel));

                                return (
                                    <span key={`month-${index}`} className="min-w-8">
                                        {showLabel ? formatMonth(monthLabel) : ""}
                                    </span>
                                );
                            })}
                        </div>

                        <div className="grid auto-rows-[12px] grid-flow-col gap-1">
                            {weeks.map((week, weekIndex) =>
                                week.map((day, dayIndex) => (
                                    <div
                                        key={`${weekIndex}-${dayIndex}`}
                                        className={`h-3 w-3 rounded-[3px] border border-white/6 ${day ? getColor(day.distanceKm) : "bg-transparent"}`}
                                        title={
                                            day
                                                ? `${day.date}: ${kmToMiles(day.distanceKm).toFixed(1)} mi across ${day.runCount} run${day.runCount === 1 ? "" : "s"}`
                                                : "No tracked activity"
                                        }
                                    />
                                )),
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/30">
                <span>Less</span>
                <div className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-white/5" />
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-emerald-500/25" />
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-emerald-400/45" />
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-cyan-300/65" />
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-sky-300/90" />
                </div>
                <span>More</span>
            </div>
        </div>
    );
}
