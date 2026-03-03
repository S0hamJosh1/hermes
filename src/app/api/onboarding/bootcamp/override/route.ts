/**
 * POST /api/onboarding/bootcamp/override
 *
 * Manual override for users who want to skip calibration bootcamp.
 * Creates a conservative default profile if none exists, then marks
 * bootcamp as completed and redirects flow to goal setup.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profile = await prisma.runnerProfile.upsert({
    where: { userId },
    update: {
      bootcampCompleted: true,
      bootcampStartDate: user.createdAt,
      bootcampEndDate: new Date(),
    },
    create: {
      userId,
      basePaceSecondsPerKm: 390,
      thresholdPaceSecondsPerKm: 343,
      weeklyCapacityKm: 20,
      durabilityScore: 0.3,
      consistencyScore: 0.3,
      riskLevel: "moderate",
      currentState: "Stable",
      overrideModeEnabled: false,
      bootcampCompleted: true,
      bootcampStartDate: user.createdAt,
      bootcampEndDate: new Date(),
    },
  });

  await prisma.momentumMeter.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  await prisma.killaMeter.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  return NextResponse.json({
    ok: true,
    profileId: profile.id,
    next: "/onboarding/goal",
  });
}

