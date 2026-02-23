/**
 * POST /api/chat — send a message, get SLM-powered response
 * GET  /api/chat — returns recent chat history
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { parseIntent, type RunnerContext } from "@/lib/slm/intent-parser";
import { conversationalPrompt } from "@/lib/slm/prompts";
import { applyPlanEdit } from "@/lib/plans/edit";
import {
    shouldTriggerCheckIn,
    generateCheckInQuestion,
    mapResponseToAction,
} from "@/lib/slm/context-checkin";

/**
 * Build runner context for the SLM from DB data.
 */
async function buildRunnerContext(userId: string): Promise<RunnerContext> {
    const profile = await prisma.runnerProfile.findUnique({
        where: { userId },
    });
    const goal = await prisma.longTermGoal.findFirst({
        where: { userId },
        orderBy: { priority: "asc" },
    });
    const latestPlan = await prisma.weeklyPlan.findFirst({
        where: { userId },
        orderBy: { weekStartDate: "desc" },
    });
    const latestSummary = await prisma.weeklySummary.findFirst({
        where: { userId },
        orderBy: { weekStartDate: "desc" },
    });

    return {
        currentState: profile?.currentState ?? "Stable",
        weeklyCapacityKm: profile ? Number(profile.weeklyCapacityKm) : 30,
        currentVolumeKm: latestPlan ? Number(latestPlan.totalVolumeKm) : 0,
        compliancePercent: latestSummary
            ? Number(latestSummary.compliancePercentage ?? 75)
            : 75,
        activeInjuries: [], // loaded below if needed
        goalDistance: goal?.distance ?? "5K",
        goalDate: goal?.targetDate
            ? goal.targetDate.toISOString().split("T")[0]
            : "TBD",
    };
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId;
    let body: { message?: string };
    try {
        body = (await req.json()) as { message?: string };
    } catch {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const userMessage = body.message?.trim();
    if (!userMessage) {
        return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Save user message
    await prisma.chatMessage.create({
        data: { userId, role: "user", content: userMessage },
    });

    // Build context
    const context = await buildRunnerContext(userId);

    // Load active injuries
    const injuries = await prisma.healthRecord.findMany({
        where: {
            userId,
            recordType: { in: ["injury", "pain"] },
            severity: { gte: 4 },
        },
        orderBy: { recordDate: "desc" },
        take: 3,
    });
    context.activeInjuries = injuries
        .map((i) => i.bodyPart)
        .filter(Boolean) as string[];

    // Parse intent (single Gemini call)
    console.log("[chat] Parsing intent for:", userMessage.slice(0, 80));
    const intent = await parseIntent(userMessage, context);
    console.log("[chat] Intent:", intent.type, "confidence:", intent.confidence);

    let assistantMessage: string;
    let intentApplied = false;
    let wasRateLimited = false;
    const supportsDirectEdit =
        intent.type === "volume_change" ||
        intent.type === "plan_level_change" ||
        intent.type === "skip_workout" ||
        intent.type === "reschedule" ||
        intent.type === "modify_workout";

    if (intent.type === "context_response") {
        const mapping = mapResponseToAction(userMessage);
        assistantMessage = mapping.description;
        intentApplied = true;
    } else if (intent.type === "plan_level_change") {
        const direction = String(intent.params?.direction ?? "increase").toLowerCase();
        const normalizedDirection = direction === "decrease" ? "decrease" : "increase";
        const changeType = String(intent.params?.changeType ?? "unspecified").toLowerCase();

        if (
            changeType !== "load" &&
            changeType !== "workout_difficulty" &&
            changeType !== "both"
        ) {
            assistantMessage =
                "Do you want more training load (volume), harder workout types (base plan difficulty), or both?";
        } else if (changeType === "load") {
            const edit = await applyPlanEdit({
                userId,
                action: "volume_change",
                params: {
                    direction: normalizedDirection,
                    amount: 0.1,
                },
                reason: "chat:plan_level_change_load",
            });
            assistantMessage = edit.ok
                ? `${edit.message} If you also want tougher workout types (not just more volume), ask for a harder base plan.`
                : `I couldn't adjust load yet: ${edit.message}`;
            intentApplied = edit.ok;
        } else if (changeType === "workout_difficulty") {
            const edit = await applyPlanEdit({
                userId,
                action: "base_plan_level_change",
                params: { direction: normalizedDirection },
                reason: "chat:plan_level_change_difficulty",
            });
            assistantMessage = edit.ok
                ? `${edit.message} This changes future plan selection (novice/intermediate/advanced fit), not just this week's distances.`
                : `I couldn't change base-plan difficulty yet: ${edit.message}`;
            intentApplied = edit.ok;
        } else {
            const levelEdit = await applyPlanEdit({
                userId,
                action: "base_plan_level_change",
                params: { direction: normalizedDirection },
                reason: "chat:plan_level_change_both_level",
            });
            const volumeEdit = await applyPlanEdit({
                userId,
                action: "volume_change",
                params: {
                    direction: normalizedDirection,
                    amount: 0.1,
                },
                reason: "chat:plan_level_change_both_volume",
            });
            intentApplied = levelEdit.ok || volumeEdit.ok;
            if (levelEdit.ok && volumeEdit.ok) {
                assistantMessage = `${levelEdit.message} ${volumeEdit.message}`;
            } else if (levelEdit.ok) {
                assistantMessage = `${levelEdit.message} I couldn't adjust volume: ${volumeEdit.message}`;
            } else if (volumeEdit.ok) {
                assistantMessage = `${volumeEdit.message} I couldn't update base-plan difficulty: ${levelEdit.message}`;
            } else {
                assistantMessage = `I couldn't apply those changes yet: ${levelEdit.message}; ${volumeEdit.message}`;
            }
        }
    } else if (
        intent.type !== "ask_question" &&
        intent.type !== "unknown" &&
        (supportsDirectEdit || intent.confidence >= 0.5)
    ) {
        if (intent.type === "volume_change") {
            const edit = await applyPlanEdit({
                userId,
                action: "volume_change",
                params: intent.params as Record<string, unknown>,
                reason: "chat:volume_change",
            });
            assistantMessage = edit.ok
                ? `${edit.message} Updated ${edit.changedWorkouts} workout${edit.changedWorkouts !== 1 ? "s" : ""}.`
                : `I couldn't apply that change yet: ${edit.message}`;
            intentApplied = edit.ok;
        } else if (intent.type === "skip_workout") {
            const edit = await applyPlanEdit({
                userId,
                action: "skip_workout",
                params: intent.params as Record<string, unknown>,
                reason: "chat:skip_workout",
            });
            assistantMessage = edit.ok
                ? `${edit.message} Safety checks passed.`
                : `I couldn't skip that workout: ${edit.message}`;
            intentApplied = edit.ok;
        } else if (intent.type === "reschedule") {
            const edit = await applyPlanEdit({
                userId,
                action: "reschedule",
                params: intent.params as Record<string, unknown>,
                reason: "chat:reschedule",
            });
            assistantMessage = edit.ok
                ? `${edit.message} Plan totals were recalculated.`
                : `I couldn't reschedule that workout: ${edit.message}`;
            intentApplied = edit.ok;
        } else if (intent.type === "modify_workout") {
            // For generic "make the plan harder/easier" requests, apply a conservative volume adjustment.
            const changes = String((intent.params?.changes as string) ?? "").toLowerCase();
            const makeEasier = /easier|lighter|less/i.test(changes) || /decrease|reduce|cut/i.test(userMessage);
            const edit = await applyPlanEdit({
                userId,
                action: "volume_change",
                params: {
                    direction: makeEasier ? "decrease" : "increase",
                    amount: 0.08,
                },
                reason: "chat:modify_workout_generic",
            });
            assistantMessage = edit.ok
                ? `${edit.message} I applied a conservative adjustment. If you want specific day changes, say “move Thursday run to Saturday” or “skip tomorrow.”`
                : `I couldn't apply that adjustment yet: ${edit.message}`;
            intentApplied = edit.ok;
        } else {
            assistantMessage = describeIntentAction(intent.type, intent.params, context);
            intentApplied = true;
        }
    } else {
        // Conversational — use SLM for a friendly response
        const latestSummary = await prisma.weeklySummary.findFirst({
            where: { userId },
            orderBy: { weekStartDate: "desc" },
        });

        const prompt = conversationalPrompt({
            currentState: context.currentState,
            weeklyCapacityKm: context.weeklyCapacityKm,
            compliancePercent: context.compliancePercent,
            goalDistance: context.goalDistance,
            recentWeekSummary: latestSummary
                ? `${Number(latestSummary.actualVolumeKm ?? 0)} km last week, ${Number(latestSummary.compliancePercentage ?? 0)}% compliance`
                : undefined,
        });

        // Get recent history for conversation continuity (exclude system messages)
        const history = await prisma.chatMessage.findMany({
            where: { userId, role: { in: ["user", "assistant"] } },
            orderBy: { createdAt: "desc" },
            take: 6,
        });

        const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
            { role: "system" as const, content: prompt },
            ...history
                .reverse()
                .map((m: { role: string; content: string }) => ({
                    role: m.role as "user" | "assistant",
                    content: m.content,
                })),
        ];

        const { chat: chatFn } = await import("@/lib/slm/client");
        console.log("[chat] Calling Gemini for conversational response...");
        const result = await chatFn(chatMessages);

        if (result.ok && result.message) {
            assistantMessage = result.message;
        } else if (result.rateLimited) {
            console.warn("[chat] Rate limited by Gemini");
            wasRateLimited = true;
            assistantMessage = "I'm being rate limited right now — the free tier has a requests-per-minute cap. Give it 30 seconds and try again!";
        } else {
            console.error("[chat] Gemini call failed:", result.error);
            const reason = result.error?.includes("timeout")
                ? "The request timed out"
                : result.error?.includes("API_KEY")
                    ? "There's an issue with my API key configuration"
                    : result.error?.includes("empty")
                        ? "I generated an empty response"
                        : "I hit an unexpected error";
            assistantMessage = `${reason} — try again in a moment! (Detail: ${result.error ?? "unknown"})`;
        }
    }

    // Check if we should trigger a context check-in
    let checkInMessage: string | null = null;
    const checkInTrigger = shouldTriggerCheckIn(context.compliancePercent, 2);
    if (checkInTrigger.shouldTrigger && !wasRateLimited) {
        // Only trigger if we haven't recently
        const recentCheckIn = await prisma.chatMessage.findFirst({
            where: {
                userId,
                role: "system",
                intentType: "context_checkin",
                createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
        });
        if (!recentCheckIn) {
            checkInMessage = await generateCheckInQuestion(checkInTrigger);
        }
    }

    // Save assistant message
    const saved = await prisma.chatMessage.create({
        data: {
            userId,
            role: "assistant",
            content: assistantMessage,
            intentType: intent.type !== "unknown" ? intent.type : null,
            intentParams: intent.type !== "unknown"
                ? (JSON.parse(JSON.stringify(intent.params)) as Record<string, string>)
                : undefined,
            intentApplied,
        },
    });

    // Save check-in message if needed
    if (checkInMessage) {
        await prisma.chatMessage.create({
            data: {
                userId,
                role: "system",
                content: checkInMessage,
                intentType: "context_checkin",
            },
        });
    }

    return NextResponse.json({
        reply: assistantMessage,
        intent: {
            type: intent.type,
            confidence: intent.confidence,
            applied: intentApplied,
        },
        checkIn: checkInMessage,
        messageId: saved.id,
    });
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

    const messages = await prisma.chatMessage.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: {
            id: true,
            role: true,
            content: true,
            intentType: true,
            intentApplied: true,
            createdAt: true,
        },
    });

    return NextResponse.json({ messages });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function describeIntentAction(
    type: string,
    params: Record<string, unknown>,
    context: RunnerContext
): string {
    switch (type) {
        case "volume_change": {
            const dir = params.direction as string;
            const amt = Math.round(((params.amount as number) ?? 0.1) * 100);
            return dir === "increase"
                ? `Got it — I'll pass a ${amt}% volume increase request to the algorithm. It'll validate this against your safety limits (current capacity: ${context.weeklyCapacityKm} km) and apply it to your next plan.`
                : `Understood — requesting a ${amt}% volume decrease. Your next plan will be lighter.`;
        }
        case "plan_level_change": {
            const direction = String(params.direction ?? "increase");
            return direction === "decrease"
                ? "Understood — we'll shift your base plan one step easier and keep it there until you change it."
                : "Understood — we'll shift your base plan one step harder and keep it there until you change it.";
        }
        case "skip_workout": {
            const date = params.date as string;
            return `Noted — marking your ${date} workout as skipped. Your weekly volume will be adjusted.`;
        }
        case "reschedule": {
            const from = params.fromDate as string;
            const to = params.toDate as string;
            return `Moving your workout from ${from} to ${to}. I'll check for hard-day spacing conflicts.`;
        }
        case "modify_workout": {
            return `I'll modify your workout. The algorithm will validate the changes against safety limits.`;
        }
        case "report_health": {
            const healthType = params.type as string;
            const severity = params.severity as number;
            return `Recorded: ${healthType} (severity ${severity}/10). ${severity >= 7
                ? "This will trigger an automatic health strike and training modification."
                : "I'll keep monitoring this."
                }`;
        }
        default:
            return "I've noted your request and will pass it to the training system.";
    }
}
