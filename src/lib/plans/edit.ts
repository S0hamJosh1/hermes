import { prisma } from "@/lib/db/client";
import { clampOffset, difficultyLabel } from "@/lib/plans/level-preference";

type PlanEditAction =
    | "volume_change"
    | "skip_workout"
    | "reschedule"
    | "base_plan_level_change";

export type PlanEditInput = {
    userId: string;
    action: PlanEditAction;
    params?: Record<string, unknown>;
    reason?: string;
};

export type PlanEditResult = {
    ok: boolean;
    message: string;
    changedWorkouts: number;
    weeklyPlanId?: string;
    totalVolumeKm?: number;
};

function toNumber(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function dateOnlyKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

async function getCurrentPlan(userId: string) {
    return prisma.weeklyPlan.findFirst({
        where: { userId },
        orderBy: { weekStartDate: "desc" },
        include: {
            workouts: {
                orderBy: [{ dayOfWeek: "asc" }, { orderInWeek: "asc" }],
            },
        },
    });
}

async function refreshPlanTotals(planId: string) {
    const workouts = await prisma.workout.findMany({
        where: { weeklyPlanId: planId },
        select: {
            plannedDistanceKm: true,
            plannedDurationMinutes: true,
        },
    });

    const totalVolumeKm = workouts.reduce(
        (sum, w) => sum + (w.plannedDistanceKm ? Number(w.plannedDistanceKm) : 0),
        0
    );
    const totalDurationMinutes = workouts.reduce(
        (sum, w) => sum + (w.plannedDurationMinutes ?? 0),
        0
    );

    await prisma.weeklyPlan.update({
        where: { id: planId },
        data: {
            totalVolumeKm: Math.round(totalVolumeKm * 100) / 100,
            totalDurationMinutes: Math.max(0, Math.round(totalDurationMinutes)),
            userEdited: true,
        },
    });

    return { totalVolumeKm: Math.round(totalVolumeKm * 10) / 10 };
}

function resolveTargetDate(raw: unknown): Date | null {
    if (typeof raw !== "string" || !raw.trim()) return null;
    const lower = raw.toLowerCase().trim();
    if (lower === "today") return startOfToday();
    if (lower === "tomorrow") {
        const d = startOfToday();
        d.setDate(d.getDate() + 1);
        return d;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
}

async function applyVolumeChange(input: PlanEditInput): Promise<PlanEditResult> {
    const plan = await getCurrentPlan(input.userId);
    if (!plan) return { ok: false, message: "No plan found to edit.", changedWorkouts: 0 };

    const direction = String(input.params?.direction ?? "increase");
    const amount = Math.max(0.02, Math.min(0.3, toNumber(input.params?.amount, 0.1)));
    const factor = direction === "decrease" ? 1 - amount : 1 + amount;

    const editableTypes = new Set(["easy_run", "long_run", "recovery", "tempo", "interval", "pace_run"]);
    let changed = 0;

    for (const w of plan.workouts) {
        if (!editableTypes.has(w.workoutType)) continue;
        const oldDistance = w.plannedDistanceKm ? Number(w.plannedDistanceKm) : 0;
        if (oldDistance <= 0) continue;

        const nextDistance = Math.max(1, Math.round(oldDistance * factor * 10) / 10);
        const pace = w.plannedPaceSecondsPerKm ?? 0;
        const nextDuration =
            pace > 0 ? Math.round((nextDistance * pace) / 60) : w.plannedDurationMinutes;

        await prisma.workout.update({
            where: { id: w.id },
            data: {
                plannedDistanceKm: nextDistance,
                plannedDurationMinutes: nextDuration ?? null,
                userModified: true,
                userModificationReason: input.reason ?? `chat:${direction}:${Math.round(amount * 100)}%`,
            },
        });
        changed++;
    }

    const totals = await refreshPlanTotals(plan.id);
    return {
        ok: true,
        weeklyPlanId: plan.id,
        changedWorkouts: changed,
        totalVolumeKm: totals.totalVolumeKm,
        message:
            direction === "decrease"
                ? `Reduced weekly load by about ${Math.round(amount * 100)}%.`
                : `Increased weekly load by about ${Math.round(amount * 100)}% (within safety checks).`,
    };
}

async function applySkipWorkout(input: PlanEditInput): Promise<PlanEditResult> {
    const plan = await getCurrentPlan(input.userId);
    if (!plan) return { ok: false, message: "No plan found to edit.", changedWorkouts: 0 };

    const requestedDate = resolveTargetDate(input.params?.date);
    const byDate = requestedDate
        ? plan.workouts.find((w) => dateOnlyKey(new Date(w.workoutDate)) === dateOnlyKey(requestedDate))
        : null;

    const target =
        byDate ??
        plan.workouts.find(
            (w) =>
                new Date(w.workoutDate) >= startOfToday() &&
                w.workoutType !== "rest" &&
                (w.plannedDistanceKm ? Number(w.plannedDistanceKm) : 0) > 0
        ) ??
        plan.workouts.find((w) => w.workoutType !== "rest");

    if (!target) {
        return { ok: false, message: "No workout available to skip.", changedWorkouts: 0 };
    }

    await prisma.workout.update({
        where: { id: target.id },
        data: {
            workoutType: "rest",
            plannedDistanceKm: null,
            plannedDurationMinutes: null,
            plannedPaceSecondsPerKm: null,
            intensityZone: "Zone 1",
            userModified: true,
            userModificationReason: input.reason ?? "chat:skip_workout",
        },
    });

    const totals = await refreshPlanTotals(plan.id);
    return {
        ok: true,
        weeklyPlanId: plan.id,
        changedWorkouts: 1,
        totalVolumeKm: totals.totalVolumeKm,
        message: `Skipped ${new Date(target.workoutDate).toLocaleDateString()} workout and converted it to rest.`,
    };
}

async function applyReschedule(input: PlanEditInput): Promise<PlanEditResult> {
    const plan = await getCurrentPlan(input.userId);
    if (!plan) return { ok: false, message: "No plan found to edit.", changedWorkouts: 0 };

    const fromDate = resolveTargetDate(input.params?.fromDate) ?? resolveTargetDate(input.params?.date);
    const toDate = resolveTargetDate(input.params?.toDate);
    if (!toDate) {
        return { ok: false, message: "Need a target date to reschedule.", changedWorkouts: 0 };
    }

    const source =
        (fromDate
            ? plan.workouts.find((w) => dateOnlyKey(new Date(w.workoutDate)) === dateOnlyKey(fromDate))
            : null) ??
        plan.workouts.find((w) => w.workoutType !== "rest");
    if (!source) {
        return { ok: false, message: "No source workout found to move.", changedWorkouts: 0 };
    }

    const target = plan.workouts.find(
        (w) => dateOnlyKey(new Date(w.workoutDate)) === dateOnlyKey(toDate)
    );
    if (!target) {
        return { ok: false, message: "Target day is outside this week’s plan.", changedWorkouts: 0 };
    }
    if (target.id === source.id) {
        return { ok: true, message: "Workout is already on that day.", changedWorkouts: 0 };
    }
    if (target.workoutType !== "rest") {
        return {
            ok: false,
            message: "Target day already has a workout. Pick a rest day or skip that workout first.",
            changedWorkouts: 0,
        };
    }

    await prisma.$transaction([
        prisma.workout.update({
            where: { id: target.id },
            data: {
                workoutType: source.workoutType,
                plannedDistanceKm: source.plannedDistanceKm,
                plannedDurationMinutes: source.plannedDurationMinutes,
                plannedPaceSecondsPerKm: source.plannedPaceSecondsPerKm,
                intensityZone: source.intensityZone,
                userModified: true,
                userModificationReason: input.reason ?? "chat:reschedule_target",
            },
        }),
        prisma.workout.update({
            where: { id: source.id },
            data: {
                workoutType: "rest",
                plannedDistanceKm: null,
                plannedDurationMinutes: null,
                plannedPaceSecondsPerKm: null,
                intensityZone: "Zone 1",
                userModified: true,
                userModificationReason: input.reason ?? "chat:reschedule_source",
            },
        }),
    ]);

    const totals = await refreshPlanTotals(plan.id);
    return {
        ok: true,
        weeklyPlanId: plan.id,
        changedWorkouts: 2,
        totalVolumeKm: totals.totalVolumeKm,
        message: `Moved workout to ${toDate.toLocaleDateString()}.`,
    };
}

async function applyBasePlanLevelChange(input: PlanEditInput): Promise<PlanEditResult> {
    const profile = await prisma.runnerProfile.findUnique({
        where: { userId: input.userId },
        select: { userId: true, planLevelOffset: true },
    });
    if (!profile) {
        return { ok: false, message: "No runner profile found for this user.", changedWorkouts: 0 };
    }

    const direction = String(input.params?.direction ?? "increase").toLowerCase();
    const delta = direction === "decrease" ? -1 : 1;
    const currentOffset = profile.planLevelOffset ?? 0;
    const nextOffset = clampOffset(currentOffset + delta);

    if (nextOffset === currentOffset) {
        return {
            ok: true,
            message:
                direction === "decrease"
                    ? "Base-plan difficulty is already at the easiest allowed setting."
                    : "Base-plan difficulty is already at the hardest allowed setting.",
            changedWorkouts: 0,
        };
    }

    await prisma.runnerProfile.update({
        where: { userId: input.userId },
        data: {
            planLevelOffset: nextOffset,
            planLevelMode: "user_override",
            planLevelUpdatedAt: new Date(),
        },
    });

    return {
        ok: true,
        changedWorkouts: 0,
        message: `Updated base-plan preference one step ${delta > 0 ? "harder" : "easier"} (${difficultyLabel(currentOffset)} -> ${difficultyLabel(nextOffset)}). Regenerate your plan to apply it.`,
    };
}

export async function applyPlanEdit(input: PlanEditInput): Promise<PlanEditResult> {
    if (input.action === "volume_change") return applyVolumeChange(input);
    if (input.action === "skip_workout") return applySkipWorkout(input);
    if (input.action === "reschedule") return applyReschedule(input);
    if (input.action === "base_plan_level_change") return applyBasePlanLevelChange(input);
    return { ok: false, message: "Unsupported edit action.", changedWorkouts: 0 };
}
