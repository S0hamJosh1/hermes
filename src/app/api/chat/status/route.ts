/**
 * GET /api/chat/status — checks if Gemini API is configured and reachable.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { checkHealth } from "@/lib/slm/client";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const health = await checkHealth();

    return NextResponse.json(health, {
        headers: { "Cache-Control": "no-store, max-age=0" },
    });
}
