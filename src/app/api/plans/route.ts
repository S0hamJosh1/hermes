/**
 * GET /api/plans
 *
 * Returns the user's weekly plans with nested workouts.
 *
 * Query params:
 *   ?current=true  — returns only the current week's plan
 *   ?limit=N       — returns the last N plans (default 4)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

function startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day + 6) % 7; // Mon=0
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;
    const { searchParams } = new URL(req.url);
    const currentOnly = searchParams.get("current") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "8", 10), 52);

    const now = new Date();
    const thisWeekStart = startOfWeek(now);

    const where = currentOnly
        ? { userId, weekStartDate: thisWeekStart }
        : { userId };

    const plans = await prisma.weeklyPlan.findMany({
        where,
        orderBy: { weekStartDate: "desc" },
        take: limit,
        include: {
            workouts: {
                orderBy: [{ dayOfWeek: "asc" }, { orderInWeek: "asc" }],
                select: {
                    id: true,
                    workoutDate: true,
                    workoutType: true,
                    workoutLabel: true,
                    plannedDistanceKm: true,
                    plannedDurationMinutes: true,
                    plannedPaceSecondsPerKm: true,
                    intensityZone: true,
                    actualDistanceKm: true,
                    actualDurationSeconds: true,
                    actualPaceSecondsPerKm: true,
                    completed: true,
                    completedAt: true,
                    dayOfWeek: true,
                    orderInWeek: true,
                    userModified: true,
                },
            },
        },
    });

    // Serialize Decimal fields
    const serialized = plans.map((plan) => ({
        id: plan.id,
        weekStartDate: plan.weekStartDate,
        weekEndDate: plan.weekEndDate,
        weekNumber: plan.weekNumber,
        stateAtGeneration: plan.stateAtGeneration,
        sourcePlanId: plan.sourcePlanId,
        totalVolumeKm: Number(plan.totalVolumeKm),
        totalDurationMinutes: plan.totalDurationMinutes,
        validationStatus: plan.validationStatus,
        published: plan.published,
        publishedAt: plan.publishedAt,
        userEdited: plan.userEdited,
        workouts: plan.workouts.map((w) => ({
            ...w,
            plannedDistanceKm: w.plannedDistanceKm
                ? Number(w.plannedDistanceKm)
                : null,
            actualDistanceKm: w.actualDistanceKm
                ? Number(w.actualDistanceKm)
                : null,
        })),
    }));

    return NextResponse.json({ plans: serialized });
}

/**
 * DELETE /api/plans
 *
 * Deletes plans by ID. Used for regeneration.
 * Body: { planIds: string[] }
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const planIds: string[] = body.planIds ?? [];
        if (planIds.length === 0) {
            return NextResponse.json({ error: "No plan IDs provided" }, { status: 400 });
        }

        await prisma.weeklyPlan.deleteMany({
            where: {
                id: { in: planIds },
                userId: session.userId,
            },
        });

        return NextResponse.json({ ok: true, deleted: planIds.length });
    } catch {
        return NextResponse.json({ error: "Failed to delete plans" }, { status: 500 });
    }
}
