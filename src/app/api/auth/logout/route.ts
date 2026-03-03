/**
 * POST /api/auth/logout
 *
 * Clears chat history and session cookie, then redirects to the home page.
 */

import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function POST(): Promise<NextResponse> {
    // Clear chat messages for the current user before logging out
    const session = await getSession();
    if (session) {
        await prisma.chatMessage.deleteMany({
            where: { userId: session.userId },
        });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const response = NextResponse.redirect(`${appUrl}/`);
    clearSessionCookie(response);
    return response;
}
