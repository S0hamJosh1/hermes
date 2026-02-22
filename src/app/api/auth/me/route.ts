/**
 * GET /api/auth/me
 *
 * Returns the current session user's basic info.
 * Used by the frontend to check if the user is logged in.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);

    if (!session) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
        authenticated: true,
        userId: session.userId,
        stravaId: session.stravaId,
        stravaUsername: session.stravaUsername,
    });
}
