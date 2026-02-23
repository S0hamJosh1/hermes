import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { applyPlanEdit } from "@/lib/plans/edit";

type EditBody = {
    action?: "volume_change" | "skip_workout" | "reschedule" | "base_plan_level_change";
    params?: Record<string, unknown>;
    reason?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: EditBody = {};
    try {
        body = (await req.json()) as EditBody;
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (!body.action) {
        return NextResponse.json({ error: "Missing action." }, { status: 400 });
    }

    const result = await applyPlanEdit({
        userId: session.userId,
        action: body.action,
        params: body.params,
        reason: body.reason ?? "api:plans/edit",
    });

    if (!result.ok) {
        return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
}
