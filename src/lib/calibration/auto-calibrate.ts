/**
 * Auto-calibration engine.
 *
 * Computes a full RunnerProfile from historical Strava activity data.
 * This is used when a user has enough history to skip the 7-day bootcamp.
 *
 * Metrics computed:
 *   basePaceSecondsPerKm    — median pace of runs 5–15km (most likely easy efforts)
 *   thresholdPaceSecondsPerKm — basePace × 0.88 (standard approximation)
 *   weeklyCapacityKm        — average weekly volume over last 4 weeks
 *   durabilityScore         — % of weeks with a run >= 10km (0.0–1.0)
 *   consistencyScore        — % of weeks with >= 3 runs (0.0–1.0)
 *   riskLevel               — based on week-to-week volume variance
 */

export type ActivityForCalibration = {
    distanceMeters: number | { toNumber(): number };
    movingTimeSeconds: number;
    startDate: Date;
};

export type CalibratedProfile = {
    basePaceSecondsPerKm: number;
    thresholdPaceSecondsPerKm: number;
    weeklyCapacityKm: number;
    durabilityScore: number;   // 0.0–1.0
    consistencyScore: number;  // 0.0–1.0
    riskLevel: "low" | "moderate" | "high";
    // Metadata for display
    dataPoints: number;        // number of runs used
    weeksAnalyzed: number;
    estimatedFromHistory: true;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toKm(meters: number | { toNumber(): number }): number {
    const m = typeof meters === "number" ? meters : meters.toNumber();
    return m / 1000;
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

/**
 * Group activities into ISO week buckets (Mon–Sun).
 * Returns a Map<weekKey, activities[]> where weekKey = "YYYY-WW".
 */
function groupByWeek(
    activities: ActivityForCalibration[]
): Map<string, ActivityForCalibration[]> {
    const map = new Map<string, ActivityForCalibration[]>();
    for (const act of activities) {
        const d = new Date(act.startDate);
        // Shift to Monday-based week
        const day = d.getDay(); // 0=Sun
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
        if (!map.has(weekKey)) map.set(weekKey, []);
        map.get(weekKey)!.push(act);
    }
    return map;
}

/**
 * Coefficient of variation (std dev / mean) — used for risk level.
 * Higher = more variable = higher risk.
 */
function coefficientOfVariation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    if (mean === 0) return 0;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) / mean;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Compute a calibrated runner profile from historical activities.
 * Activities should already be filtered to runs only.
 */
export function autoCalibrate(
    activities: ActivityForCalibration[]
): CalibratedProfile {
    const runs = activities.filter((a) => toKm(a.distanceMeters) >= 0.5);

    // ── Base pace: median pace of runs 5–15km ─────────────────────────────────
    const calibrationRuns = runs.filter((a) => {
        const km = toKm(a.distanceMeters);
        return km >= 5 && km <= 15 && a.movingTimeSeconds > 0;
    });

    const paces = calibrationRuns.map((a) => {
        const km = toKm(a.distanceMeters);
        return a.movingTimeSeconds / km; // seconds per km
    });

    // Fallback: if no 5–15km runs, use all runs >= 3km
    const fallbackRuns = runs.filter((a) => {
        const km = toKm(a.distanceMeters);
        return km >= 3 && a.movingTimeSeconds > 0;
    });
    const fallbackPaces = fallbackRuns.map((a) => a.movingTimeSeconds / toKm(a.distanceMeters));

    const rawBasePace = paces.length >= 3 ? median(paces) : median(fallbackPaces);
    // Clamp to reasonable range: 4:00/km (240s) to 10:00/km (600s)
    const basePaceSecondsPerKm = Math.round(Math.max(240, Math.min(rawBasePace, 600)));
    const thresholdPaceSecondsPerKm = Math.round(basePaceSecondsPerKm * 0.88);

    // ── Weekly grouping ───────────────────────────────────────────────────────
    const weekMap = groupByWeek(runs);
    const allWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const weeksAnalyzed = allWeeks.length;

    // Last 4 weeks for capacity
    const last4Weeks = allWeeks.slice(-4);
    const last4Volumes = last4Weeks.map(([, acts]) =>
        acts.reduce((sum, a) => sum + toKm(a.distanceMeters), 0)
    );
    const weeklyCapacityKm = last4Volumes.length > 0
        ? Math.round((last4Volumes.reduce((s, v) => s + v, 0) / last4Volumes.length) * 10) / 10
        : 20; // fallback

    // ── Durability: % of weeks with a run >= 10km ─────────────────────────────
    const weeksWithLongRun = allWeeks.filter(([, acts]) =>
        acts.some((a) => toKm(a.distanceMeters) >= 10)
    ).length;
    const durabilityScore = weeksAnalyzed > 0
        ? Math.round((weeksWithLongRun / weeksAnalyzed) * 100) / 100
        : 0.3;

    // ── Consistency: % of weeks with >= 3 runs ────────────────────────────────
    const weeksWithEnoughRuns = allWeeks.filter(([, acts]) => acts.length >= 3).length;
    const consistencyScore = weeksAnalyzed > 0
        ? Math.round((weeksWithEnoughRuns / weeksAnalyzed) * 100) / 100
        : 0.3;

    // ── Risk level: based on week-to-week volume variance ─────────────────────
    const allWeeklyVolumes = allWeeks.map(([, acts]) =>
        acts.reduce((sum, a) => sum + toKm(a.distanceMeters), 0)
    );
    const cv = coefficientOfVariation(allWeeklyVolumes);
    // cv < 0.3 = consistent = low risk
    // cv 0.3–0.6 = moderate
    // cv > 0.6 = erratic = high risk
    const riskLevel: "low" | "moderate" | "high" =
        cv < 0.3 ? "low" : cv < 0.6 ? "moderate" : "high";

    return {
        basePaceSecondsPerKm,
        thresholdPaceSecondsPerKm,
        weeklyCapacityKm,
        durabilityScore: Math.min(1, Math.max(0, durabilityScore)),
        consistencyScore: Math.min(1, Math.max(0, consistencyScore)),
        riskLevel,
        dataPoints: runs.length,
        weeksAnalyzed,
        estimatedFromHistory: true,
    };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/** Format pace seconds/km as "M:SS /km" */
export function formatPace(secondsPerKm: number): string {
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.round(secondsPerKm % 60);
    return `${mins}:${String(secs).padStart(2, "0")} /km`;
}

/** Format a 0–1 score as a percentage string */
export function formatScore(score: number): string {
    return `${Math.round(score * 100)}%`;
}
