/**
 * Data sufficiency check for auto-calibration.
 *
 * Determines whether a user's Strava history has enough data to skip
 * the 7-day bootcamp and auto-calibrate their runner profile.
 *
 * Thresholds:
 *   - At least 4 weeks of run history (28+ days span)
 *   - At least 8 runs total
 *   - At least 1 run >= 5km (for meaningful pace data)
 */

// Minimal shape we need from a stored activity
export type ActivityForSufficiency = {
    distanceMeters: number | { toNumber(): number }; // Prisma Decimal or number
    movingTimeSeconds: number;
    startDate: Date;
};

export type SufficiencyStats = {
    totalRuns: number;
    weeksOfHistory: number;
    longestRunKm: number;
    oldestRunDate: Date | null;
    newestRunDate: Date | null;
    // What's missing (empty if sufficient)
    missingReasons: string[];
};

export type SufficiencyResult = {
    sufficient: boolean;
    reason: string;
    stats: SufficiencyStats;
};

// ─── Thresholds ───────────────────────────────────────────────────────────────

const MIN_RUNS = 8;
const MIN_WEEKS_HISTORY = 4;
const MIN_LONG_RUN_KM = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toKm(meters: number | { toNumber(): number }): number {
    const m = typeof meters === "number" ? meters : meters.toNumber();
    return m / 1000;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Check whether the provided activities are sufficient for auto-calibration.
 * Activities should already be filtered to runs only.
 */
export function checkDataSufficiency(
    activities: ActivityForSufficiency[]
): SufficiencyResult {
    const runs = activities.filter((a) => toKm(a.distanceMeters) >= 0.5); // ignore sub-500m blips

    const missingReasons: string[] = [];

    // Sort by date
    const sorted = [...runs].sort(
        (a, b) => a.startDate.getTime() - b.startDate.getTime()
    );

    const oldestRunDate = sorted[0]?.startDate ?? null;
    const newestRunDate = sorted[sorted.length - 1]?.startDate ?? null;

    const longestRunKm = runs.reduce(
        (max, a) => Math.max(max, toKm(a.distanceMeters)),
        0
    );

    // Calculate weeks of history
    let weeksOfHistory = 0;
    if (oldestRunDate && newestRunDate) {
        const spanMs = newestRunDate.getTime() - oldestRunDate.getTime();
        weeksOfHistory = Math.floor(spanMs / (7 * 24 * 60 * 60 * 1000));
    }

    const stats: SufficiencyStats = {
        totalRuns: runs.length,
        weeksOfHistory,
        longestRunKm: Math.round(longestRunKm * 10) / 10,
        oldestRunDate,
        newestRunDate,
        missingReasons,
    };

    // Check thresholds
    if (runs.length < MIN_RUNS) {
        missingReasons.push(
            `Only ${runs.length} run${runs.length !== 1 ? "s" : ""} found — need at least ${MIN_RUNS}.`
        );
    }

    if (weeksOfHistory < MIN_WEEKS_HISTORY) {
        missingReasons.push(
            `Only ${weeksOfHistory} week${weeksOfHistory !== 1 ? "s" : ""} of history — need at least ${MIN_WEEKS_HISTORY}.`
        );
    }

    if (longestRunKm < MIN_LONG_RUN_KM) {
        missingReasons.push(
            `Longest run is ${longestRunKm.toFixed(1)}km — need at least one run of ${MIN_LONG_RUN_KM}km+ for pace calibration.`
        );
    }

    if (missingReasons.length === 0) {
        return {
            sufficient: true,
            reason: `Found ${runs.length} runs over ${weeksOfHistory} weeks — enough to auto-calibrate.`,
            stats,
        };
    }

    return {
        sufficient: false,
        reason: `Not enough data for auto-calibration. ${missingReasons[0]}`,
        stats,
    };
}
