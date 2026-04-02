/**
 * GET /api/auth/me
 *
 * Returns the current session user's basic info.
 * Used by the frontend to check if the user is logged in.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { fetchCurrentAthlete, getValidAccessToken } from "@/lib/auth/strava";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);

    if (!session) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    let stravaUsername = session.stravaUsername;
    let displayName: string | undefined;

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
                accessToken: true,
                accessTokenExpiresAt: true,
                refreshToken: true,
                stravaUsername: true,
            },
        });

        if (user) {
            stravaUsername = user.stravaUsername ?? stravaUsername;

            const accessToken = await getValidAccessToken(user, async (data) => {
                await prisma.user.update({
                    where: { id: session.userId },
                    data,
                });
            });

            const athlete = await fetchCurrentAthlete(accessToken);
            const fullName = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ").trim();

            stravaUsername = athlete.username ?? stravaUsername;
            displayName = fullName || undefined;
        }
    } catch {
        // Fall back to session data if Strava profile enrichment is unavailable.
    }

    return NextResponse.json({
        authenticated: true,
        userId: session.userId,
        stravaId: session.stravaId,
        stravaUsername,
        displayName,
    });
}
