/**
 * POST /api/health/report
 *
 * Report an injury, pain, fatigue, or illness.
 *
 * Body:
 *   recordType: "injury" | "pain" | "fatigue" | "illness"
 *   bodyPart?: string         (required for injury/pain)
 *   severity: number          (1-10)
 *   description?: string
 *   daysOff?: number          (requested days off, default 0)
 *
 * Creates a HealthRecord and potentially issues/escalates a HealthStrike.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const VALID_RECORD_TYPES = ["injury", "pain", "fatigue", "illness"];

const BODY_PARTS = [
    "ankle", "achilles", "calf", "shin", "knee", "hamstring",
    "quad", "hip", "glute", "groin", "foot", "plantar fascia",
    "it band", "lower back", "upper back", "shoulder", "general",
];

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getSessionFromRequest(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
        recordType,
        bodyPart,
        severity,
        description,
        daysOff = 0,
    } = body as {
        recordType?: string;
        bodyPart?: string;
        severity?: number;
        description?: string;
        daysOff?: number;
    };

    // Validation
    if (!recordType || !VALID_RECORD_TYPES.includes(recordType)) {
        return NextResponse.json(
            { error: `recordType must be one of: ${VALID_RECORD_TYPES.join(", ")}` },
            { status: 400 }
        );
    }

    if ((recordType === "injury" || recordType === "pain") && !bodyPart) {
        return NextResponse.json(
            { error: "bodyPart is required for injury/pain reports" },
            { status: 400 }
        );
    }

    if (typeof severity !== "number" || severity < 1 || severity > 10) {
        return NextResponse.json(
            { error: "severity must be a number between 1 and 10" },
            { status: 400 }
        );
    }

    const userId = session.userId;

    // Determine training modification based on severity
    let trainingModification = "none";
    if (severity >= 8) trainingModification = "full_rest";
    else if (severity >= 6) trainingModification = "reduced_volume";
    else if (severity >= 4) trainingModification = "reduced_intensity";
    else trainingModification = "monitor";

    // Create health record
    const record = await prisma.healthRecord.create({
        data: {
            userId,
            recordDate: new Date(),
            recordType,
            bodyPart: bodyPart?.toLowerCase() ?? null,
            severity,
            description: description ?? null,
            trainingModification,
            daysOff,
            strikeCount: 0,
            isChronic: false,
        },
    });

    // Strike logic:
    // - Severity 7+: immediate strike
    // - Recurring body part (3+ records in 90 days): escalating strike
    let strikeIssued = false;
    let strikeData = null;

    if (severity >= 7 || recordType === "injury") {
        // Check for existing unresolved strikes on this body part
        const existingStrike = bodyPart
            ? await prisma.healthStrike.findFirst({
                where: {
                    userId,
                    bodyPart: bodyPart.toLowerCase(),
                    resolved: false,
                },
                orderBy: { issuedAt: "desc" },
            })
            : null;

        let newStrikeCount = 1;
        if (existingStrike) {
            // Escalate
            newStrikeCount = existingStrike.strikeCount + 1;
            await prisma.healthStrike.update({
                where: { id: existingStrike.id },
                data: {
                    strikeCount: newStrikeCount,
                    issuedAt: new Date(),
                    forcedRecoveryDays:
                        newStrikeCount >= 3
                            ? Math.max(existingStrike.forcedRecoveryDays ?? 0, 7)
                            : newStrikeCount >= 2
                                ? 3
                                : null,
                    permanentLimitApplied: newStrikeCount >= 3,
                    limitDescription:
                        newStrikeCount >= 3
                            ? `Chronic ${bodyPart?.toLowerCase()} issue — permanent volume limit applied.`
                            : null,
                },
            });
            strikeData = {
                id: existingStrike.id,
                escalated: true,
                strikeCount: newStrikeCount,
                forcedRecoveryDays: newStrikeCount >= 3 ? 7 : newStrikeCount >= 2 ? 3 : 0,
            };
        } else {
            // New strike
            const newStrike = await prisma.healthStrike.create({
                data: {
                    userId,
                    strikeType: recordType,
                    strikeCount: 1,
                    bodyPart: bodyPart?.toLowerCase() ?? null,
                    forcedRecoveryDays: severity >= 8 ? 3 : null,
                },
            });
            strikeData = {
                id: newStrike.id,
                escalated: false,
                strikeCount: 1,
                forcedRecoveryDays: severity >= 8 ? 3 : 0,
            };
        }

        strikeIssued = true;

        // Update the health record with strike info
        await prisma.healthRecord.update({
            where: { id: record.id },
            data: {
                strikeCount: newStrikeCount,
                isChronic: newStrikeCount >= 3,
            },
        });
    }

    // Check for chronic patterns (3+ records on same body part in 90 days)
    let chronicWarning = false;
    if (bodyPart) {
        const recentSameBodyPart = await prisma.healthRecord.count({
            where: {
                userId,
                bodyPart: bodyPart.toLowerCase(),
                recordDate: {
                    gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                },
            },
        });
        if (recentSameBodyPart >= 3) {
            chronicWarning = true;
        }
    }

    return NextResponse.json({
        ok: true,
        record: {
            id: record.id,
            recordType: record.recordType,
            bodyPart: record.bodyPart,
            severity: record.severity,
            trainingModification,
        },
        strike: strikeIssued ? strikeData : null,
        chronicWarning,
        message: strikeIssued
            ? `Health strike ${strikeData?.escalated ? "escalated" : "issued"}. ${(strikeData?.forcedRecoveryDays ?? 0) > 0
                ? `${strikeData?.forcedRecoveryDays} forced recovery days.`
                : ""
            }`
            : chronicWarning
                ? `Chronic pattern detected for ${bodyPart}. Consider rest.`
                : "Health record logged.",
    });
}

/**
 * GET /api/health/report
 *
 * Returns the list of valid body parts and record types for the report form.
 */
export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        recordTypes: VALID_RECORD_TYPES,
        bodyParts: BODY_PARTS,
    });
}
