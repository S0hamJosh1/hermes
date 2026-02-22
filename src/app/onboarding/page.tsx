/**
 * /onboarding — Server component router.
 *
 * Checks the user's onboarding state and redirects accordingly:
 *   - No profile → /onboarding/check (calibration or bootcamp)
 *   - Profile, no active goal → /onboarding/goal
 *   - Profile + goal → /dashboard
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export default async function OnboardingPage() {
    const session = await getSession();
    if (!session) redirect("/?error=unauthenticated");

    const profile = await prisma.runnerProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true, bootcampCompleted: true },
    });

    if (!profile || !profile.bootcampCompleted) {
        redirect("/onboarding/check");
    }

    const activeGoal = await prisma.longTermGoal.findFirst({
        where: { userId: session.userId, priority: 1 },
        select: { id: true },
    });

    if (!activeGoal) {
        redirect("/onboarding/goal");
    }

    redirect("/dashboard");
}
