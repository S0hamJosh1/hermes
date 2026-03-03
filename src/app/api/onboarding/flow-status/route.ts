import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile, activeGoal] = await Promise.all([
    prisma.runnerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, bootcampCompleted: true },
    }),
    prisma.longTermGoal.findFirst({
      where: { userId: session.userId, priority: 1 },
      select: { id: true },
    }),
  ]);

  const bootcampCompleted = Boolean(profile?.bootcampCompleted);
  const hasGoal = Boolean(activeGoal);

  return NextResponse.json({
    bootcampCompleted,
    hasGoal,
    shouldGoToBootcamp: !bootcampCompleted,
    shouldGoToGoal: bootcampCompleted && !hasGoal,
  });
}

