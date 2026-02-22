/**
 * Pattern Detector — analyzes 28-day workout history for behavioral patterns.
 *
 * This is PURE algorithmic logic — no SLM involved.
 * Returns structured pattern insights the UI can display.
 */

export type DetectedPattern = {
    id: string;
    label: string;
    description: string;
    severity: "info" | "suggestion" | "warning";
    actionable: boolean;
    suggestion?: string;
};

type WorkoutEntry = {
    workoutType: string;
    plannedDistanceKm: number | null;
    actualDistanceKm: number | null;
    completed: boolean;
    dayOfWeek: number;
    workoutDate: string | Date;
};

/**
 * Analyze a set of workouts (ideally 28+ days) for behavioral patterns.
 */
export function detectPatterns(workouts: WorkoutEntry[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    if (workouts.length < 7) return patterns;

    // 1. Skipping easy runs but completing hard sessions
    const easyRuns = workouts.filter((w) => w.workoutType === "easy_run" || w.workoutType === "recovery");
    const hardSessions = workouts.filter((w) =>
        ["tempo", "interval", "pace_run", "time_trial", "fartlek"].includes(w.workoutType)
    );
    const longRuns = workouts.filter((w) => w.workoutType === "long_run");

    const easyCompletionRate = easyRuns.length > 0
        ? easyRuns.filter((w) => w.completed).length / easyRuns.length
        : 1;
    const hardCompletionRate = hardSessions.length > 0
        ? hardSessions.filter((w) => w.completed).length / hardSessions.length
        : 1;

    if (easyCompletionRate < 0.5 && hardCompletionRate > 0.7 && easyRuns.length >= 3) {
        patterns.push({
            id: "skip_easy_run_quality",
            label: "Easy Run Skipper",
            description: `You're completing ${Math.round(hardCompletionRate * 100)}% of quality sessions but only ${Math.round(easyCompletionRate * 100)}% of easy runs.`,
            severity: "suggestion",
            actionable: true,
            suggestion: "We could try a plan with fewer easy runs and more cross-training or rest days.",
        });
    }

    // 2. Consistent overperformance (running longer than planned)
    const withActuals = workouts.filter(
        (w) => w.completed && w.actualDistanceKm && w.plannedDistanceKm && w.plannedDistanceKm > 0
    );
    if (withActuals.length >= 5) {
        const overPerformCount = withActuals.filter(
            (w) => (w.actualDistanceKm ?? 0) > (w.plannedDistanceKm ?? 0) * 1.15
        ).length;
        const overPerformRate = overPerformCount / withActuals.length;

        if (overPerformRate > 0.5) {
            patterns.push({
                id: "consistent_overperformance",
                label: "Overperformer",
                description: `You're running ${Math.round(overPerformRate * 100)}% of workouts more than 15% over planned distance.`,
                severity: "info",
                actionable: true,
                suggestion: "You might be ready for a volume increase. The system will evaluate in the next adaptation cycle.",
            });
        }
    }

    // 3. Repeatedly missing specific days
    const daySkips: Record<number, { total: number; skipped: number }> = {};
    for (const w of workouts) {
        if (!daySkips[w.dayOfWeek]) daySkips[w.dayOfWeek] = { total: 0, skipped: 0 };
        daySkips[w.dayOfWeek].total++;
        if (!w.completed) daySkips[w.dayOfWeek].skipped++;
    }

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (const [dayStr, stats] of Object.entries(daySkips)) {
        const day = Number(dayStr);
        if (stats.total >= 3 && stats.skipped / stats.total > 0.6) {
            patterns.push({
                id: `skip_day_${day}`,
                label: `${dayNames[day]} Problem`,
                description: `You've skipped ${stats.skipped} of ${stats.total} workouts on ${dayNames[day]}s.`,
                severity: "suggestion",
                actionable: true,
                suggestion: `Would you like to move your ${dayNames[day]} workout to a different day?`,
            });
        }
    }

    // 4. Long run consistency
    if (longRuns.length >= 3) {
        const longRunCompletion = longRuns.filter((w) => w.completed).length / longRuns.length;
        if (longRunCompletion < 0.5) {
            patterns.push({
                id: "long_run_skip",
                label: "Long Run Struggle",
                description: `Only completing ${Math.round(longRunCompletion * 100)}% of long runs.`,
                severity: "warning",
                actionable: true,
                suggestion: "Long runs are key for your goal. We could start with shorter distances and build up gradually.",
            });
        }
    }

    // 5. Running more than planned overall (volume creep)
    if (withActuals.length >= 5) {
        const totalPlanned = withActuals.reduce((sum, w) => sum + (w.plannedDistanceKm ?? 0), 0);
        const totalActual = withActuals.reduce((sum, w) => sum + (w.actualDistanceKm ?? 0), 0);
        if (totalPlanned > 0 && totalActual / totalPlanned > 1.2) {
            patterns.push({
                id: "volume_creep",
                label: "Volume Creep",
                description: `Your actual volume is ${Math.round((totalActual / totalPlanned - 1) * 100)}% higher than planned. This increases injury risk.`,
                severity: "warning",
                actionable: false,
            });
        }
    }

    return patterns;
}
