export type RaceDistance = "5K" | "10K" | "Half Marathon" | "Marathon";

export type ActivityPerformanceSample = {
    distanceMeters: unknown;
    movingTimeSeconds: number;
    startDate: Date;
};

export type Effort = {
    timeSeconds: number;
    date: string;
    distanceKm: number;
};

export type DistanceEfforts = {
    best: Effort | null;
    secondBest: Effort | null;
};

export type PersonalBestMap = Record<RaceDistance, DistanceEfforts>;

const TARGET_KM: Record<RaceDistance, number> = {
    "5K": 5,
    "10K": 10,
    "Half Marathon": 21.0975,
    "Marathon": 42.195,
};

const TOLERANCE_RATIO: Record<RaceDistance, number> = {
    "5K": 0.08,
    "10K": 0.07,
    "Half Marathon": 0.06,
    "Marathon": 0.05,
};

function toNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function isWithinTarget(distanceKm: number, targetKm: number, tolerance: number): boolean {
    return distanceKm >= targetKm * (1 - tolerance) && distanceKm <= targetKm * (1 + tolerance);
}

export function computePersonalBests(
    activities: ActivityPerformanceSample[]
): PersonalBestMap {
    const out: PersonalBestMap = {
        "5K": { best: null, secondBest: null },
        "10K": { best: null, secondBest: null },
        "Half Marathon": { best: null, secondBest: null },
        "Marathon": { best: null, secondBest: null },
    };

    const valid = activities
        .map((a) => ({
            distanceKm: toNumber(a.distanceMeters, 0) / 1000,
            timeSeconds: a.movingTimeSeconds,
            date: new Date(a.startDate),
        }))
        .filter((a) => a.distanceKm > 0 && a.timeSeconds > 0);

    (Object.keys(TARGET_KM) as RaceDistance[]).forEach((race) => {
        const target = TARGET_KM[race];
        const tol = TOLERANCE_RATIO[race];

        const candidates = valid
            .filter((a) => isWithinTarget(a.distanceKm, target, tol))
            .sort((a, b) => a.timeSeconds - b.timeSeconds);

        const best = candidates[0];
        const second = candidates[1];

        out[race] = {
            best: best
                ? {
                    timeSeconds: Math.round(best.timeSeconds),
                    date: best.date.toISOString(),
                    distanceKm: Math.round(best.distanceKm * 100) / 100,
                }
                : null,
            secondBest: second
                ? {
                    timeSeconds: Math.round(second.timeSeconds),
                    date: second.date.toISOString(),
                    distanceKm: Math.round(second.distanceKm * 100) / 100,
                }
                : null,
        };
    });

    return out;
}
