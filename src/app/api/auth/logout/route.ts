/**
 * POST /api/auth/logout
 *
 * Clears the session cookie and redirects to the home page.
 */

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(): Promise<NextResponse> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const response = NextResponse.redirect(`${appUrl}/`);
    clearSessionCookie(response);
    return response;
}
