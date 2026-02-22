/**
 * GET /api/health/strikes
 *
 * Returns the user's health strike summary:
 *   - Active (unresolved) strikes
 *   - Total strike count
 *   - Breakdown by body part
 *
 * POST /api/health/strikes
 *
 * Resolve a specific strike.
 * Body: { strikeId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;

    const [activeStrikes, allStrikes] = await Promise.all([
        prisma.healthStrike.findMany({
            where: { userId, resolved: false },
            orderBy: { issuedAt: "desc" },
            select: {
                id: true,
                strikeType: true,
                strikeCount: true,
                bodyPart: true,
                issuedAt: true,
                forcedRecoveryDays: true,
                permanentLimitApplied: true,
                limitDescription: true,
            },
        }),
        prisma.healthStrike.count({ where: { userId } }),
    ]);

    return NextResponse.json({
        activeStrikes,
        activeCount: activeStrikes.length,
        totalHistorical: allStrikes,
    });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { strikeId } = body as { strikeId?: string };

    if (!strikeId) {
        return NextResponse.json(
            { error: "strikeId is required" },
            { status: 400 }
        );
    }

    // Verify ownership
    const strike = await prisma.healthStrike.findFirst({
        where: { id: strikeId, userId: session.userId },
    });

    if (!strike) {
        return NextResponse.json(
            { error: "Strike not found" },
            { status: 404 }
        );
    }

    if (strike.resolved) {
        return NextResponse.json(
            { error: "Strike already resolved" },
            { status: 400 }
        );
    }

    await prisma.healthStrike.update({
        where: { id: strikeId },
        data: {
            resolved: true,
            resolvedAt: new Date(),
        },
    });

    return NextResponse.json({
        ok: true,
        message: "Strike resolved.",
    });
}
