"use client";

import { kmToMiles } from "@/lib/units";

type ActivityDay = {
    date: string;
    distanceKm: number;
    durationMinutes: number;
    runCount: number;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getColor(distanceKm: number): string {
    const distanceMiles = kmToMiles(distanceKm);
    if (distanceMiles === 0) return "bg-white/5";
    if (distanceMiles < 2) return "bg-emerald-500/30";
    if (distanceMiles < 4) return "bg-emerald-400/45";
    if (distanceMiles < 7) return "bg-lime-300/60";
    if (distanceMiles < 10) return "bg-cyan-300/75";
    return "bg-sky-300/90";
}

function formatMonth(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", { month: "short" });
}

export function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
    const displayDays = days.slice(-70);
    const byDate = new Map(displayDays.map((day) => [day.date, day]));
    const firstDate = new Date(`${displayDays[0].date}T00:00:00`);
    const lastDate = new Date(`${displayDays[displayDays.length - 1].date}T00:00:00`);

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

    const totalMiles = displayDays.reduce((sum, day) => sum + kmToMiles(day.distanceKm), 0);
    const activeDays = displayDays.filter((day) => day.runCount > 0).length;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-white/45">
                <span>{activeDays} active days in the last 10 weeks</span>
                <span>{totalMiles.toFixed(0)} total miles</span>
            </div>

            <div className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4">
                <div className="overflow-x-auto pb-1">
                    <div className="inline-flex min-w-full gap-3">
                        <div className="flex flex-col justify-between pt-7 text-[10px] uppercase tracking-[0.18em] text-white/25">
                            {DAY_LABELS.map((label) => (
                                <span key={label} className="flex h-3 items-center">
                                    {label}
                                </span>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="grid auto-cols-[12px] grid-flow-col gap-1 text-[10px] uppercase tracking-[0.18em] text-white/25">
                                {weeks.map((week, index) => {
                                    const monthLabel = week.find(Boolean)?.date;
                                    const previousLabel = weeks[index - 1]?.find(Boolean)?.date;
                                    const showLabel =
                                        monthLabel &&
                                        (!previousLabel || formatMonth(monthLabel) !== formatMonth(previousLabel));

                                    return (
                                        <span key={`month-${index}`} className="w-3 text-left">
                                            {showLabel ? formatMonth(monthLabel) : ""}
                                        </span>
                                    );
                                })}
                            </div>

                            <div className="grid grid-rows-7 auto-cols-[12px] grid-flow-col gap-1">
                                {weeks.map((week, weekIndex) =>
                                    week.map((day, dayIndex) => (
                                        <div
                                            key={`${weekIndex}-${dayIndex}`}
                                            className={`h-3 w-3 rounded-[3px] border border-white/6 transition-colors ${day ? getColor(day.distanceKm) : "bg-transparent"}`}
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
            </div>

            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-white/30">
                <span>Less</span>
                <div className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-white/5" />
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-emerald-500/30" />
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-emerald-400/45" />
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-lime-300/60" />
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-cyan-300/75" />
                    <span className="h-3 w-3 rounded-[3px] border border-white/6 bg-sky-300/90" />
                </div>
                <span>More</span>
            </div>
        </div>
    );
}
