/**
 * Health integration module.
 *
 * Provides functions to gather health data (injuries, strikes) from the database
 * and convert them into the InjuryProtection[] format expected by the algorithm
 * pipeline's ValidatorContext.
 *
 * This bridges the gap between the database health records and the algorithm.
 */

import { prisma } from "@/lib/db/client";
import type { InjuryProtection } from "@/types/training";

/**
 * Load active injury protections for a user.
 *
 * An injury is considered "active" if:
 *   - It's a health record of type 'injury' or 'pain'
 *   - It was recorded in the last 30 days
 *   - It has severity >= 4
 *
 * OR if there's an unresolved health strike for a body part.
 */
export async function loadActiveInjuries(
    userId: string
): Promise<InjuryProtection[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get recent injury/pain records
    const recentRecords = await prisma.healthRecord.findMany({
        where: {
            userId,
            recordType: { in: ["injury", "pain"] },
            severity: { gte: 4 },
            recordDate: { gte: thirtyDaysAgo },
        },
        orderBy: { recordDate: "desc" },
    });

    // Get unresolved strikes
    const unresolvedStrikes = await prisma.healthStrike.findMany({
        where: { userId, resolved: false },
    });

    // Build InjuryProtection[] — deduplicate by body part, take highest severity
    const protectionMap = new Map<string, InjuryProtection>();

    for (const record of recentRecords) {
        const part = record.bodyPart ?? "general";
        const existing = protectionMap.get(part);
        const severity = record.severity ?? 4;

        if (!existing || severity > existing.severity) {
            protectionMap.set(part, {
                bodyPart: part,
                severity,
                daysOff: record.daysOff,
                reducedVolume: severity >= 5,
                reducedIntensity: severity >= 4,
                lockUntil: severity >= 8
                    ? new Date(Date.now() + record.daysOff * 24 * 60 * 60 * 1000)
                    : null,
            });
        }
    }

    // Add strike-driven protections (if body part not already covered)
    for (const strike of unresolvedStrikes) {
        const part = strike.bodyPart ?? "general";
        if (!protectionMap.has(part)) {
            const baseSeverity = strike.strikeCount >= 3 ? 8 : strike.strikeCount >= 2 ? 6 : 5;
            const forcedDays = strike.forcedRecoveryDays ?? 0;
            protectionMap.set(part, {
                bodyPart: part,
                severity: baseSeverity,
                daysOff: forcedDays,
                reducedVolume: baseSeverity >= 5,
                reducedIntensity: baseSeverity >= 4,
                lockUntil: forcedDays > 0
                    ? new Date(strike.issuedAt.getTime() + forcedDays * 24 * 60 * 60 * 1000)
                    : null,
            });
        }
    }

    return Array.from(protectionMap.values());
}

/**
 * Get the total active (unresolved) strike count for a user.
 */
export async function getActiveStrikeCount(userId: string): Promise<number> {
    return prisma.healthStrike.count({
        where: { userId, resolved: false },
    });
}

/**
 * Get the current compliance percentage from the most recent weekly summary.
 * Falls back to 80% if no data exists.
 */
export async function getCurrentCompliancePercentage(
    userId: string
): Promise<number> {
    const latest = await prisma.weeklySummary.findFirst({
        where: { userId },
        orderBy: { weekStartDate: "desc" },
        select: { compliancePercentage: true },
    });

    if (latest?.compliancePercentage) {
        return Number(latest.compliancePercentage);
    }

    return 80;
}

/**
 * Get the number of weeks since the user's last state change.
 */
export async function getWeeksSinceLastStateChange(
    userId: string
): Promise<number> {
    const lastTransition = await prisma.adaptationHistory.findFirst({
        where: { userId },
        orderBy: { transitionDate: "desc" },
        select: { transitionDate: true },
    });

    if (!lastTransition) {
        return 4;
    }

    const weeksSince = Math.floor(
        (Date.now() - lastTransition.transitionDate.getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    );

    return Math.max(0, weeksSince);
}
